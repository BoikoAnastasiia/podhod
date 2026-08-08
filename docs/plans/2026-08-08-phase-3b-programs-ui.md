# Подход Phase 3b — Programs UI Implementation Plan

**Goal:** Let a signed-in person build a training program in the browser: create programs, activate one, add and reorder days, pick exercises from the library, and configure a progression scheme for each.

**Architecture:** Two routes — `/programs` and `/programs/$programId` — both gated by the existing `requireSession` guard. TanStack Query owns server state; every mutation invalidates rather than patching the cache by hand, because a program edit changes positions across sibling rows and a hand-patched cache would drift. Forms validate against the same Zod schemas the Worker parses, so a rejected request is a bug rather than an expected path.

**Tech Stack:** React 19 · TanStack Router · TanStack Query · Tailwind 4 · Zod 4

**Progress (2026-08-08):** All seven tasks are done and committed. Task 3 also
created `routes/programs/$programId.tsx` earlier than planned, because Task 2's
cards link to it and the route tree would not typecheck without it. Tasks 4 and
5 landed in the reverse of their planned order — the picker's flow ends in the
scheme editor, so committing the picker first would have shipped a dead end —
and the day card moved out of the route into `DayEditor.tsx` (where the plan's
file structure always had it) before the picker was wired in. The e2e suite
covers the full build path, activation exclusivity, the signed-out redirect,
and editing/removing an entry.

**Design note:** Visual design is parked by the owner until the logic is complete. This phase adds **no new tokens, no new colours, no new layout ideas** — it reuses the existing card, chip and button classes as they stand. The result will look plain. That is deliberate, and the design pass will cover these screens along with the rest.

## Global Constraints

- **No inline styles.** No `style={{...}}` anywhere. Tailwind utilities only.
- **No Tailwind arbitrary values.** Every utility resolves to an existing `@theme` token. If a value is missing, reuse a near one rather than adding a token — the design pass owns the token set.
- **Every user-visible string goes through `useI18n()`** with both `en` and `ru` entries. No literal English in JSX.
- Both routes call `requireSession(location.href)` in `beforeLoad`, per `routes/settings.tsx`.
- Mutations invalidate the affected query key; **no optimistic updates in this phase.** Reordering rewrites sibling positions server-side, so an optimistic cache is guessing at values the server computes.
- Forms parse with the shared schema before calling the API, so validation errors render without a round trip — the server parse stays the real gate.
- All numerals render with `tabular-nums`, matching the library.
- Interactive controls meet the existing 44px tap-target minimum (`min-h-tap`).
- `pnpm --filter <pkg> run <script>` — always with `run`.
- **No new dependencies.**

### Reordering: buttons, not drag-and-drop

Days and exercises reorder with up/down buttons rather than dragging. Three reasons, recorded here because "add drag-and-drop" is the obvious later suggestion:

1. Drag-and-drop needs a dependency (`dnd-kit` or equivalent) and this phase adds none.
2. Buttons are keyboard-operable and screen-reader-announceable without extra work; accessible DnD is substantially more work than the drag itself.
3. Drag affordances are a visual design decision, and design is parked.

The API takes a complete ordered list either way, so swapping in dragging later is a component change with no server change.

---

## File Structure

```
apps/web/src/lib/
├── api.ts                       MOD  program fetchers and mutations
└── programKeys.ts               NEW  query keys in one place

apps/web/src/routes/
├── programs/
│   ├── index.tsx                NEW  list, create, activate, archive, delete
│   └── $programId.tsx           NEW  day editor
└── __root.tsx                   MOD  nav entry

apps/web/src/components/
├── DayEditor.tsx                NEW  one day: rename, reorder, delete, its exercises
├── ExercisePicker.tsx           NEW  search the library, add to a day
├── SchemeEditor.tsx             NEW  the four schemes as one discriminated form
├── SchemeSummary.tsx            NEW  read-only one-line rendering of a scheme
└── ReorderButtons.tsx           NEW  up/down pair, shared by days and exercises

apps/web/src/i18n/
└── dict.ts                      MOD  every new string, en + ru

apps/web/e2e/
└── programs.spec.ts             NEW  build a program end to end
```

`SchemeSummary` is separate from `SchemeEditor` because the summary is needed in three places (the day editor's list, the picker's confirmation, and later the session player's target line) while the editor is needed in one.

---

## Task 1: API client and query keys

**Files:**
- Create: `apps/web/src/lib/programKeys.ts`
- Modify: `apps/web/src/lib/api.ts`
- Test: `apps/web/src/lib/api.test.ts` (extend)

**Interfaces:**
- Produces: `fetchPrograms()`, `fetchProgram(id, lang)`, `createProgram`, `updateProgram`, `deleteProgram`, `createDay`, `updateDay`, `deleteDay`, `reorderDays`, `addExercise`, `updateExercise`, `deleteExercise`, `reorderExercises`, and `programKeys`.

- [ ] **Step 1: Write the query keys**

`apps/web/src/lib/programKeys.ts`:

```ts
import type { Lang } from "@podhod/schema";

/**
 * Query keys in one module rather than inline at each call site: a mutation
 * has to invalidate exactly the keys a query used, and a typo in an inline
 * array fails silently — the request succeeds, the screen keeps showing stale
 * data, and nothing errors.
 *
 * The detail key carries `lang` because the exercise names in a program come
 * from the library join and differ per language; without it, switching
 * language would show the previous language's names from cache.
 */
export const programKeys = {
  all: ["programs"] as const,
  list: () => [...programKeys.all, "list"] as const,
  detail: (id: string, lang: Lang) => [...programKeys.all, "detail", id, lang] as const,
};
```

- [ ] **Step 2: Add the fetchers and mutations**

Append to `apps/web/src/lib/api.ts`. The existing `get<T>()` helper covers reads; writes need a sibling that sends JSON and tolerates a 204:

```ts
/**
 * Writes return either 201 with a body or 204 with none, so this cannot
 * unconditionally parse JSON — `res.json()` on an empty body throws a
 * SyntaxError that would surface as a mutation failure on a request that
 * actually succeeded.
 */
async function send<T>(
  method: string,
  path: string,
  body?: unknown,
  parse?: (v: unknown) => T,
): Promise<T | undefined> {
  const res = await fetch(path, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!res.ok) {
    const parsed = errorResponseSchema.safeParse(await res.json().catch(() => null));
    throw new Error(parsed.success ? parsed.data.error.code : `http_${res.status}`);
  }
  if (res.status === 204) return undefined;
  const json = await res.json();
  return parse ? parse(json) : (json as T);
}
```

Then one function per endpoint, each returning the parsed shape.

- [ ] **Step 3: Extend the client tests**

`apps/web/src/lib/api.test.ts` — the existing suite stubs `fetch`. Add cases for: a 204 resolving rather than throwing; an error envelope surfacing its `code`; `fetchProgram` passing `lang` through as a query parameter.

```ts
it("resolves a 204 rather than failing on an empty body", async () => {
  // res.json() on an empty body throws SyntaxError, which would look to the
  // caller exactly like a failed request.
  stubFetch(new Response(null, { status: 204 }));
  await expect(deleteProgram("p1")).resolves.toBeUndefined();
});
```

- [ ] **Step 4: Run and commit**

Run: `pnpm --filter @podhod/web run test && pnpm typecheck`

```bash
git add apps/web
git commit -m "Add the program API client and its query keys"
```

---

## Task 2: The programs list

**Files:**
- Create: `apps/web/src/routes/programs/index.tsx`
- Modify: `apps/web/src/i18n/dict.ts`, `apps/web/src/components/Nav.tsx`
- Test: covered by `apps/web/e2e/programs.spec.ts` in Task 7

Shows every program with its day count, which one is active, and archived ones separated. Create by name. Activate, archive, unarchive, delete.

- [ ] **Step 1: Build the route**

Follows `routes/settings.tsx`: `beforeLoad: ({ location }) => requireSession(location.href)`, `useQuery` on `programKeys.list()`, mutations invalidating it.

Points that need care:

```tsx
/**
 * Deleting is irreversible and sits next to archiving, which is not — and the
 * two read almost identically at a glance. The delete control therefore asks
 * for confirmation inline (a second click on a control that has changed its
 * label) rather than firing on the first. Not a window.confirm: that blocks
 * the event loop and cannot be styled or translated.
 */
```

Empty state matters here — a new account has no programs, and an empty list with no explanation is the worst first impression the app can make. It gets a real message and a create form, not a bare heading.

- [ ] **Step 2: Add the strings**

Every string in both locales. Russian for the domain terms: `программа`, `день`, `упражнение`, `подход`, `повтор`.

- [ ] **Step 3: Nav entry**

`/programs` joins the nav, visible only when signed in — the library stays public, programs never are.

- [ ] **Step 4: Run and commit**

```bash
git add apps/web
git commit -m "List, create and activate programs"
```

---

## Task 3: The day editor

**Files:**
- Create: `apps/web/src/routes/programs/$programId.tsx`, `apps/web/src/components/DayEditor.tsx`, `apps/web/src/components/ReorderButtons.tsx`
- Modify: `apps/web/src/i18n/dict.ts`

- [ ] **Step 1: ReorderButtons**

```tsx
/**
 * Up/down rather than dragging — see the plan's Global Constraints for why.
 * The buttons disable at the ends rather than disappearing, so the control
 * does not reflow the row as items move, and each carries an aria-label naming
 * the item it moves ("Move Push up") rather than a bare arrow, which a screen
 * reader would announce as "button" with no object.
 */
```

The component takes the current index, the length, and an `onMove(from, to)` callback. It never sees the full list — the route builds the reordered id array and posts it whole, matching the API.

- [ ] **Step 2: The route and DayEditor**

`useQuery` on `programKeys.detail(id, lang)`. Days render in order, each with its name (editable in place), its exercises, and reorder controls.

- [ ] **Step 3: Run and commit**

```bash
git add apps/web
git commit -m "Add, rename and reorder the days in a program"
```

---

## Task 4: The exercise picker

**Files:**
- Create: `apps/web/src/components/ExercisePicker.tsx`
- Modify: `apps/web/src/i18n/dict.ts`

Reuses `fetchExercises` — the same search the library page uses, so nothing new is needed server-side.

- [ ] **Step 1: Build it**

```tsx
/**
 * An inline panel rather than a modal dialog. A modal needs a focus trap,
 * scroll locking, an Escape handler and an accessible name to be correct, and
 * gets those wrong quietly; a panel that expands in place needs none of it and
 * loses nothing here, since picking an exercise is not an interruption of
 * something else — it is the task.
 *
 * Search is debounced, matching the library's own behaviour, and results are
 * capped rather than paginated: this is a picker, and someone who cannot find
 * an exercise in the first page should refine the search instead of scrolling
 * 1,324 rows.
 */
```

Choosing an exercise opens the scheme editor rather than adding immediately — an exercise with no scheme is not a valid program entry, and the API would reject it.

- [ ] **Step 2: Run and commit**

```bash
git add apps/web
git commit -m "Pick exercises from the library into a program day"
```

---

## Task 5: The scheme editor

**Files:**
- Create: `apps/web/src/components/SchemeEditor.tsx`, `apps/web/src/components/SchemeSummary.tsx`
- Modify: `apps/web/src/i18n/dict.ts`
- Test: `apps/web/src/components/schemeEditor.test.ts` — the value-building logic, extracted so it is testable without rendering

The most interesting component in the phase: one form whose fields depend on the selected scheme, validated by `schemeSchema`.

- [ ] **Step 1: Extract the defaults**

```ts
/**
 * Sensible starting values per scheme, so switching kind produces a valid
 * scheme immediately rather than a form full of empty required fields.
 *
 * These are training defaults, not arbitrary ones: 2.5 kg is the smallest pair
 * of plates most gyms have; three failures before a deload and a 10% cut are
 * the Starting Strength convention; 8-12 is the most common hypertrophy range;
 * RPE 8 with 5% steps is a standard autoregulated prescription.
 */
export const SCHEME_DEFAULTS = { /* one per kind */ };
```

- [ ] **Step 2: The editor**

Percentages are entered as **whole numbers and stored as fractions** — a field labelled "%" that wants `0.1` is a trap. The conversion happens at the form boundary, once, with a test.

```ts
/**
 * The form shows 10 and the schema wants 0.1. Converting at the boundary keeps
 * the wire format unambiguous (fractions everywhere, as packages/schema
 * documents) while the field reads the way a percentage field should. Doing it
 * anywhere else means two representations circulating in the same component.
 */
export function toFraction(percent: number): number;
export function toPercent(fraction: number): number;
```

- [ ] **Step 3: Test the conversion and defaults**

```ts
it.each([[10, 0.1], [5, 0.05], [2.5, 0.025]])("converts %s%% to %s", (percent, fraction) => {
  expect(toFraction(percent)).toBeCloseTo(fraction, 10);
});

it("round-trips every default through the schema it must satisfy", () => {
  // A default that fails validation would make the editor unusable on open —
  // the one state a user cannot avoid reaching.
  for (const scheme of Object.values(SCHEME_DEFAULTS)) {
    expect(schemeSchema.safeParse(scheme).success).toBe(true);
  }
});
```

- [ ] **Step 4: Run and commit**

```bash
git add apps/web
git commit -m "Configure a progression scheme per exercise"
```

---

## Task 6: Exercise management within a day

**Files:**
- Modify: `apps/web/src/components/DayEditor.tsx`, `apps/web/src/i18n/dict.ts`

Reorder, edit the scheme of, and remove an exercise already in a day.

- [ ] **Step 1: Wire the mutations**
- [ ] **Step 2: Run and commit**

```bash
git add apps/web
git commit -m "Reorder and edit the exercises inside a day"
```

---

## Task 7: End-to-end coverage

**Files:**
- Create: `apps/web/e2e/programs.spec.ts`

One test that builds a program the way a person would, because the individual pieces passing does not prove they compose.

- [ ] **Step 1: The full path**

```ts
test("builds a program from nothing", async ({ page }) => {
  // Sign up, create a program, activate it, add two days, add an exercise to
  // each with a different scheme, reorder the days, and reload — asserting the
  // order survived the round trip rather than only the local state.
});
```

Plus: `/programs` redirects to sign-in when signed out; a second program can be activated and the first goes inactive in the UI.

- [ ] **Step 2: Run everything and commit**

Run: `pnpm typecheck && pnpm test && pnpm --filter @podhod/web run e2e`

```bash
git add apps/web
git commit -m "Cover building a program end to end"
```

---

## What this plan does not do

- **No visual design.** Parked by the owner. Existing tokens and classes only.
- **No drag-and-drop.** See Global Constraints; the API is already shaped for it whenever it arrives.
- **No target computation on screen.** `nextTarget()` needs history, which does not exist until the session player.
- **No workout logging.** That is the next phase, and the largest.
