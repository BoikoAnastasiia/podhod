# Подход Phase 3c — Programs UX Implementation Plan

**Goal:** Make building a program fast enough to feel effortless — one-click days, instant exercise adds with editable defaults, and four ready-made programs («Взять программу») that copy into the account fully built.

**Architecture:** Templates are static bilingual data in the web app, replayed through the existing program API (`createProgram` → `createDay` → `addExercise`) in the visitor's current language — no schema or endpoint changes. The builder flow inverts its current shape: configuration stops gating creation. Adding a day or an exercise happens immediately with a sensible default; the rename field and the scheme editor become after-the-fact tools.

**Research grounding (2026-08-09):** Hevy/Strong/Boostcamp all lead with templates ("pick a program, start in under 2 minutes"), build routines on a single screen with search overlays, and never block an add on a configuration form — defaults first, edit later. The target is goal → plan → first meaningful screen in under 60 seconds.

**Tech Stack:** React 19 · TanStack Router · TanStack Query · Tailwind 4 · Zod 4

**Decisions (approved 2026-08-09):**
- Template copies are ordinary programs — editable, archivable, deletable with the controls that already exist. The gallery is static UI, not rows in the user's list.
- No multi-select in the picker. Instant add makes each pick one click; the panel staying open covers the "add five in a row" case.
- No rollback machinery for a template copy that fails mid-sequence: show the standard error, leave the partial program (deletable). Rare, recoverable, not worth a transaction endpoint.
- The instant-add default scheme is `SCHEME_DEFAULTS.linear` (3×5, +2.5 кг) — the app's flagship progression.
- **Icons are a curated emoji set**, not an icon library — zero dependencies, and the parked design pass can swap emoji for real iconography later without touching the data model. Programs gain a nullable `icon` column (the one backend change in this phase); templates ship with an icon; the program page offers a preset row to change it.
- **Tags are template metadata, rendered as chips** — legs / glutes / back / arms / full body (ноги / ягодицы / спина / руки / всё тело). Not filters yet: four templates don't need filtering; the chips become filters for free when the gallery grows.
- Gallery layout: multi-column cards on desktop, single-column compact card-rows on mobile, via standard responsive variants of existing utilities.

## Global Constraints

Carried over from Phase 3b, still in force:

- **No new dependencies.** No inline styles, no Tailwind arbitrary values — existing `@theme` tokens only.
- **Every user-visible string goes through `useI18n()`** with both `en` and `ru` entries. Template names/descriptions/day names are bilingual in the template data itself (they are data, not dictionary).
- Mutations invalidate; no optimistic updates. Tap targets ≥ `min-h-tap-min`. Numerals `tabular-nums`.
- `pnpm --filter <pkg> run <script>` — always with `run`. After adding utilities, grep the built CSS.
- Visual design stays parked: existing card/chip/button classes only.
- e2e needs the root `pnpm dev` running first (see NEXT-STEPS.md traps).

---

## File Structure

```
apps/api/migrations/0003_program_icon.sql
                                 NEW  hand-written: ALTER TABLE programs ADD COLUMN icon TEXT
apps/api/src/db/schema.ts        MOD  icon column on programs
apps/api/src/routes/programs.ts  MOD  icon in create/patch/list/detail

packages/schema/src/program.ts   MOD  icon in create/update inputs and summary/detail outputs

apps/web/src/data/
└── programTemplates.ts          NEW  4 templates: bilingual names, icon, tags, days, ids, schemes
apps/web/src/data/programTemplates.test.ts
                                 NEW  ids exist in dataset, schemes parse, tags known, both languages

apps/web/src/lib/
└── materializeTemplate.ts       NEW  replay a template through the API in one language

apps/web/src/components/
├── DayEditor.tsx                MOD  instant add: pick → added with default scheme; panel stays open
└── IconPicker.tsx               NEW  preset emoji row, PATCHes the program's icon

apps/web/src/routes/programs/
├── index.tsx                    MOD  «Готовые программы» gallery, icons on cards, Open button, empty-state CTA
└── $programId.tsx               MOD  one-click add day (auto-named), icon + IconPicker next to the title

apps/web/src/routes/index.tsx    MOD  landing copy: programs are live
apps/web/src/i18n/dict.ts        MOD  new strings, en + ru
apps/web/e2e/programs.spec.ts    MOD  flow updates + template test + icon change
```

---

## Task 0: The icon column, end to end

**Files:**
- Create: `apps/api/migrations/0003_program_icon.sql`
- Modify: `packages/schema/src/program.ts`, `apps/api/src/db/schema.ts`, `apps/api/src/routes/programs.ts`
- Test: extend `apps/api/test/programs.test.ts`

**Interfaces:**
- Produces: `icon?: string | null` accepted by `createProgramSchema`/`updateProgramSchema`; `icon: string | null` on `programSummarySchema`/`programDetailSchema`; client fns pass it through unchanged (they already send whole input objects).

- [ ] **Step 1: Hand-written migration** (drizzle-kit regeneration would drop the partial index from `0002` — see NEXT-STEPS traps; never regenerate)

```sql
ALTER TABLE programs ADD COLUMN icon TEXT;
```

- [ ] **Step 2: Schema and contracts**

`db/schema.ts`: `icon: text("icon")` on the programs table. `packages/schema/src/program.ts`: `const icon = z.string().trim().min(1).max(16).nullish();` added to `createProgramSchema` and `updateProgramSchema`; `icon: z.string().nullable()` on `programSummarySchema` and `programExerciseSchema`'s parent `programDetailSchema` inherits via summary. 16 chars fits any emoji incl. ZWJ sequences.

- [ ] **Step 3: Routes** — create inserts `icon: parsed.icon ?? null`; PATCH includes `icon` when present (same pattern as `notes`); list/detail SELECTs add the column.

- [ ] **Step 4: Test** — extend the create/patch round-trip test in `apps/api/test/programs.test.ts`: create with `icon: "🦵"`, expect it in the list; PATCH to `"🍑"`, expect the detail to answer with it; PATCH `{ icon: null }` clears it.

- [ ] **Step 5: Migrate local, run, commit**

Run: `pnpm --filter @podhod/api run db:migrate:local && pnpm --filter @podhod/api run test && pnpm typecheck`

```bash
git add apps/api packages/schema
git commit -m "Give programs an optional icon"
```

---

## Task 1: Template data and its validation test

**Files:**
- Create: `apps/web/src/data/programTemplates.ts`
- Test: `apps/web/src/data/programTemplates.test.ts`

**Interfaces:**
- Produces: `type ProgramTemplate`, `const PROGRAM_TEMPLATES: ProgramTemplate[]`, `type Localized = { en: string; ru: string }`.

- [ ] **Step 1: Write the template module**

```ts
import type { SchemeInput } from "@podhod/schema";

export type Localized = { en: string; ru: string };

/** legs / glutes / back / arms / full body — a clean partition, unlike "upper body". */
export type TemplateTag = "legs" | "glutes" | "back" | "arms" | "fullBody";

export type TemplateExercise = { exerciseId: string; scheme: SchemeInput };
export type TemplateDay = { name: Localized; exercises: TemplateExercise[] };

export type ProgramTemplate = {
  /** Stable key for testids and analytics, never shown. */
  id: string;
  name: Localized;
  description: Localized;
  /** One of PROGRAM_ICONS — carried onto the copy, changeable afterwards. */
  icon: string;
  tags: TemplateTag[];
  days: TemplateDay[];
};

/** The preset row the IconPicker offers; templates draw from the same set. */
export const PROGRAM_ICONS = ["💪", "🦵", "🍑", "🏋️", "🤸", "🏃", "⚡", "🔥", "🧘", "❤️"] as const;
```

Template icons/tags: `leg-day` 🦵 `["legs"]` · `hips-glutes` 🍑 `["glutes", "legs"]` · `full-body-3x` ⚡ `["fullBody"]` · `upper-lower` 🏋️ `["fullBody", "back", "arms", "legs"]`. Tag display names go in the dictionary (`tags.legs` «ноги», `tags.glutes` «ягодицы», `tags.back` «спина», `tags.arms` «руки», `tags.fullBody` «всё тело»); the validation test asserts every tag has both dict entries.

Four templates, ids verified against `data/exercises.seed.json` on 2026-08-09. Schemes deliberately span all kinds so the gallery doubles as a showcase — linear for the compound lifts, double progression for accessories, one RPE and one fixed entry where they genuinely fit:

- **`leg-day`** — «День ног» / "Leg Day": `0043` barbell full squat (linear 3×5 +2.5), `0739` sled 45° leg press (double 3×8–12 +5), `0085` barbell romanian deadlift (linear 3×8 +2.5), `0336` dumbbell lunge (double 3×10–15 +2.5), `0605` lever standing calf raise (double 4×10–15 +5).
- **`hips-glutes`** — «Ягодицы и бёдра» / "Hips & Glutes": `1409` barbell glute bridge (linear 3×8 +2.5), `1459` dumbbell romanian deadlift (double 3×8–12 +2.5), `0597` lever seated hip abduction (double 3×12–20 +2.5), `0431` dumbbell step-up (double 3×8–12 +2.5), `0549` kettlebell swing (fixed 3×15 · 16 kg).
- **`full-body-3x`** — «Фулбоди 3×» / "Full Body 3×", three days A/B/C: A: `0043` squat (linear 3×5 +2.5), `0025` barbell bench press (linear 3×5 +2.5), `0861` cable seated row (double 3×8–12 +2.5). B: `0032` barbell deadlift (linear 1×5 +5), `0091` barbell seated overhead press (linear 3×5 +2.5), `0198` cable pulldown (double 3×8–12 +2.5). C: `1760` dumbbell goblet squat (double 3×8–12 +2.5), `0289` dumbbell bench press (double 3×8–12 +2.5), `0293` dumbbell bent over row (double 3×8–12 +2.5).
- **`upper-lower`** — «Верх / Низ» / "Upper / Lower", four days: Upper A: `0025` bench (linear 3×5 +2.5), `0027` barbell bent over row (linear 3×5 +2.5), `0091` seated OHP (double 3×8–12 +2.5), `0334` dumbbell lateral raise (rpe 3×12 @ RPE 8 ±5%), `0294` dumbbell biceps curl (double 3×8–12 +2.5). Lower A: `0043` squat (linear 3×5 +2.5), `0085` RDL (linear 3×8 +2.5), `0585` lever leg extension (double 3×10–15 +2.5), `0594` lever seated calf raise (double 4×10–15 +5). Upper B: `0047` barbell incline bench (double 3×8–12 +2.5), `0198` cable pulldown (double 3×8–12 +2.5), `0603` lever shoulder press (double 3×8–12 +2.5), `0241` cable triceps pushdown v-bar (double 3×10–15 +2.5). Lower B: `0032` deadlift (linear 1×5 +5), `0739` sled leg press (double 3×8–12 +5), `0599` lever seated leg curl (double 3×10–15 +2.5), `0605` standing calf raise (double 4×10–15 +5).

Day names bilingual: «День ног», «Ягодицы и бёдра», «День A/B/C», «Верх A», «Низ A», «Верх B», «Низ B» (en: "Leg day", "Hips & glutes", "Day A/B/C", "Upper A", …). Linear schemes use `failuresBeforeDeload: 3, deloadPct: 0.1` throughout.

- [ ] **Step 2: Write the validation test**

```ts
import { schemeSchema } from "@podhod/schema";
import { describe, expect, it } from "vitest";
import dataset from "../../../../data/exercises.seed.json" with { type: "json" };
import { PROGRAM_TEMPLATES } from "./programTemplates.js";

// Test-only import of the 1,324-row dataset — the template module itself must
// stay tiny, which is why templates carry ids, not exercise objects.
const knownIds = new Set((dataset as { id: string }[]).map((e) => e.id));

describe("PROGRAM_TEMPLATES", () => {
  it("references only exercises that exist in the dataset", () => {
    for (const template of PROGRAM_TEMPLATES)
      for (const day of template.days)
        for (const exercise of day.exercises)
          expect(knownIds, `${template.id}: ${exercise.exerciseId}`).toContain(
            exercise.exerciseId,
          );
  });

  it("carries only schemes the API would accept", () => {
    for (const template of PROGRAM_TEMPLATES)
      for (const day of template.days)
        for (const exercise of day.exercises)
          expect(schemeSchema.safeParse(exercise.scheme).success).toBe(true);
  });

  it("has both languages for every visible string", () => {
    for (const template of PROGRAM_TEMPLATES) {
      expect(template.name.en.length).toBeGreaterThan(0);
      expect(template.name.ru.length).toBeGreaterThan(0);
      for (const day of template.days) {
        expect(day.name.en.length).toBeGreaterThan(0);
        expect(day.name.ru.length).toBeGreaterThan(0);
      }
    }
  });
});
```

- [ ] **Step 3: Run and commit**

Run: `pnpm --filter @podhod/web run test && pnpm typecheck`

```bash
git add apps/web/src/data
git commit -m "Ship four ready-made program templates as data"
```

---

## Task 2: One-click add day

**Files:**
- Modify: `apps/web/src/routes/programs/$programId.tsx`, `apps/web/src/i18n/dict.ts`

The name input goes away; «Добавить день» creates «День N» immediately (N = current count + 1, in the current language). Renaming already exists on the card and covers everyone who cares about names.

- [ ] **Step 1: Replace the form with a button**

```tsx
const addDay = useMutation({
  mutationFn: () => createDay(programId, `${t("days.defaultName")} ${days.length + 1}`),
  onSuccess: invalidate,
});
```

Dict: `"days.defaultName": "Day"` / `"День"`. The button keeps `data-testid="add-day"`; the `new-day-name` input and its dict placeholder are deleted (remove `days.name.placeholder` from both locales).

- [ ] **Step 2: Run, typecheck, commit**

```bash
git add apps/web
git commit -m "Create days with one click and a default name"
```

---

## Task 3: Instant add from the picker

**Files:**
- Modify: `apps/web/src/components/DayEditor.tsx`, `apps/web/src/i18n/dict.ts`

**Interfaces:**
- Consumes: `SCHEME_DEFAULTS.linear` from `SchemeEditor.tsx`, `addExercise` from `lib/api.ts`.

The `Adding` two-step state machine collapses to `pickerOpen: boolean`. Clicking a picker result calls `add.mutate({ exerciseId, scheme: SCHEME_DEFAULTS.linear })` immediately; the panel **stays open** for the next pick (the multi-add path). The scheme-step panel is deleted; `SchemeEditor` remains mounted only through the existing edit-in-place flow, which Task 6 of Phase 3b already built.

- [ ] **Step 1: Rework the state and handler**

```tsx
const [pickerOpen, setPickerOpen] = useState(false);

const add = useMutation({
  mutationFn: (input: CreateProgramExerciseInput) => addExercise(day.id, input),
  onSuccess: invalidate, // picker stays open — no setAdding(null)
});
...
<ExercisePicker
  onPick={(exercise) =>
    add.mutate({ exerciseId: exercise.id, scheme: SCHEME_DEFAULTS.linear })
  }
  onClose={() => setPickerOpen(false)}
/>
```

`picker.failed` renders above the panel on `add.isError`. Dict: `picker.submit` is now unused — delete it from both locales; add `"picker.hint": "Tap an exercise to add it — the scheme is editable afterwards."` / `"Нажмите на упражнение, чтобы добавить его — схему можно изменить после."` rendered as muted text at the top of the panel. (The hint lives in DayEditor, passed no — rendered inside ExercisePicker under the search input; plumb nothing.)

- [ ] **Step 2: Run, typecheck, commit**

```bash
git add apps/web
git commit -m "Add a picked exercise instantly with an editable default scheme"
```

---

## Task 4: The template gallery and copy flow

**Files:**
- Create: `apps/web/src/lib/materializeTemplate.ts`
- Modify: `apps/web/src/routes/programs/index.tsx`, `apps/web/src/i18n/dict.ts`

**Interfaces:**
- Consumes: `PROGRAM_TEMPLATES`, `ProgramTemplate` from Task 1; `createProgram`, `createDay`, `addExercise` from `lib/api.ts`.
- Produces: `materializeTemplate(template: ProgramTemplate, lang: Lang): Promise<string>` — resolves to the new program's id.

- [ ] **Step 1: The materializer**

```ts
import type { Lang } from "@podhod/schema";
import { addExercise, createDay, createProgram } from "./api.js";
import type { ProgramTemplate } from "../data/programTemplates.js";

/**
 * Replays a template through the same three endpoints the hand-building flow
 * uses, in the visitor's language. Sequential on purpose: day and exercise
 * order is positional server-side, and firing creates concurrently would
 * race the positions. ~15 requests against a local Worker is imperceptible.
 *
 * No rollback on mid-sequence failure — the partial program is visible and
 * deletable, which is a better failure mode than invisible cleanup logic.
 */
export async function materializeTemplate(
  template: ProgramTemplate,
  lang: Lang,
): Promise<string> {
  const programId = await createProgram({
    name: template.name[lang],
    notes: null,
    icon: template.icon,
  });
  if (!programId) throw new Error("internal");
  for (const day of template.days) {
    const dayId = await createDay(programId, day.name[lang]);
    if (!dayId) throw new Error("internal");
    for (const exercise of day.exercises) {
      await addExercise(dayId, exercise);
    }
  }
  return programId;
}
```

- [ ] **Step 2: The gallery section on `/programs`**

Below the live programs list, above archived: heading `t("templates.heading")` («Готовые программы» / "Ready-made programs"). Layout: `grid gap-3 sm:grid-cols-2` — one compact card-row per template on mobile, two-up cards on desktop (standard responsive variant, no new tokens; grep the built CSS for `sm:grid-cols-2` after building). Each card (existing card classes): the icon at text-2xl, localized name, description, tag chips (inactive `FilterChips` styling, labels via `t("tags.*")`), `N дней · M упражнений` via the existing `plural()` helper, and a `bg-accent` button `t("templates.take")` («Взять программу» / "Take this program"), `data-testid="take-template-{id}"`. `materializeTemplate` passes `icon: template.icon` into `createProgram`. On click:

```tsx
const take = useMutation({
  mutationFn: (template: ProgramTemplate) => materializeTemplate(template, lang),
  onSuccess: async (programId) => {
    await queryClient.invalidateQueries({ queryKey: programKeys.all });
    if (programId) await navigate({ to: "/programs/$programId", params: { programId } });
  },
});
```

While pending, the clicked button disables (`disabled:opacity-50`, label `t("templates.taking")` «Создаём…» / "Building…"). On error, `t("templates.failed")` («Не удалось создать программу.» / "Couldn't build that program.") renders under the gallery heading with `role="alert"`. In the empty state, the gallery renders **above** the explanatory card, because "take one" is the better first step than "read what a program is".

- [ ] **Step 3: Run, typecheck, commit**

```bash
git add apps/web
git commit -m "Offer ready-made programs that copy into the account"
```

---

## Task 5: Affordances and landing copy

**Files:**
- Modify: `apps/web/src/routes/programs/index.tsx`, `apps/web/src/routes/programs/$programId.tsx`, `apps/web/src/routes/index.tsx`, `apps/web/src/i18n/dict.ts`

- [ ] **Step 1: An explicit way into a program, and its icon**

The card's button row gains a leading pill `t("programs.open")` (the key already exists, unused) as a `Link` styled with the existing pill classes, `data-testid="open-program"`. The name link stays and is now preceded by the program's icon (plain text span, `aria-hidden`, nothing when `icon` is null).

- [ ] **Step 1b: IconPicker on the program page**

`apps/web/src/components/IconPicker.tsx`: takes `{ programId, current }`, renders a `t("icon.change")` pill («Значок» / "Icon", `data-testid="change-icon"`) that toggles a row of `PROGRAM_ICONS` buttons (chip classes, `aria-pressed` on the current one, `data-testid="icon-option-{emoji}"`) plus a `t("icon.none")` option («Без значка» / "None") sending `icon: null`. Selecting PATCHes via `updateProgram(programId, { icon })` and invalidates `programKeys.all`. Rendered beside the `program-title` heading on `$programId.tsx`, which also shows the current icon before the title.

- [ ] **Step 2: Empty-state pointers**

`programs.dayCount.zero` on the program page gets company: `"days.emptyHint": "Add a first day — the button above creates one instantly."` / `"Добавьте первый день — кнопка выше создаст его мгновенно."` rendered under the existing zero-days message.

- [ ] **Step 3: Landing copy**

`landing.today.body` gains programs; `landing.coming.body` moves to the session player. En: today — "…and, once signed in, training programs: ready-made or your own, with progression rules per exercise."; coming — "A guided session player that walks you through each workout set by set and computes your next targets from history. Not built yet." Ru mirrors: today — "…а после входа — программы тренировок: готовые или свои, с правилами прогрессии для каждого упражнения."; coming — "Режим тренировки, который ведёт по сетам и сам считает следующие цели по истории. Пока не реализовано."

- [ ] **Step 4: Run, typecheck, commit**

```bash
git add apps/web
git commit -m "Point every empty state at its next action"
```

---

## Task 6: End-to-end coverage

**Files:**
- Modify: `apps/web/e2e/programs.spec.ts`

- [ ] **Step 1: Update the build test for the new flow**

"builds a program from nothing" changes: `add-day` is clicked without filling an input (days arrive as «Day 1»/«Day 2» — rename «Day 1» → «Day A» through the existing rename flow to keep the reorder assertions meaningful); picking an exercise asserts the row appears immediately with the linear summary (`10%`), no scheme-step; a second pick while the panel is open proves it stayed open. The scheme-edit test keeps covering the editor itself.

- [ ] **Step 2: New template test**

```ts
test("taking a template yields a full editable program", async ({ page }) => {
  await signUp(page, "programs-template");
  await page.goto("/programs");

  await page.getByTestId("take-template-leg-day").click();
  // materialize navigates to the new program when done
  await expect(page.getByTestId("program-title")).toHaveText("Leg Day");
  await expect(page.getByTestId("day-card")).toHaveCount(1);
  await expect(page.getByTestId("day-exercise")).toHaveCount(5);
  // It is an ordinary program: delete an entry to prove it's editable.
  await page.getByTestId("remove-entry").first().click();
  await page.getByTestId("confirm-remove-entry").first().click();
  await expect(page.getByTestId("day-exercise")).toHaveCount(4);

  // The template's icon came along, and the preset row can change it.
  await page.getByTestId("change-icon").click();
  await page.getByTestId("icon-option-💪").click();
  await page.goto("/programs");
  await expect(
    page.getByTestId("program-card").filter({ hasText: "Leg Day" }),
  ).toContainText("💪");
});
```

- [ ] **Step 3: Run everything and commit**

Run: `pnpm typecheck && pnpm test && pnpm --filter @podhod/web run e2e` (root `pnpm dev` running first).

```bash
git add apps/web
git commit -m "Cover templates and the instant-add flow end to end"
```

---

## What this plan does not do

- **No server-side template storage or copy endpoint.** Client replay through existing routes; revisit only if templates ever need to change without a deploy.
- **No multi-select picker.** Instant add covers the speed; revisit after the session player if real use disagrees.
- **No visual design.** Still parked. Existing tokens and classes only.
- **No target computation.** Unchanged: `nextTarget()` waits for the session player.
