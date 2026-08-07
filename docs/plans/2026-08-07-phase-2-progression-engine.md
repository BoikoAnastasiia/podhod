# Подход Phase 2 — Progression Engine Implementation Plan

**Goal:** Build `packages/core` test-first: `nextTarget()` computes the next set/rep/weight prescription for an exercise from its scheme and the user's own history, for all four schemes, plus the loadability and one-rep-max maths the rest of the app needs.

**Architecture:** Pure functions. No `Date`, no I/O, no network, no randomness — ordering of the `history` array is the only temporal information the engine gets. That is what makes it exhaustively testable with table-driven cases and no mocks. The scheme shapes are Zod schemas in `packages/schema`, so the scheme editor (next plan) validates against the same contract the engine parses.

**Tech Stack:** TypeScript 5.7 · Zod 4 · Vitest 3

**Ordering note:** The design doc lists Programs as phase 2 and the engine as phase 3. This plan inverts them deliberately. `program_exercises.scheme_config` is JSON whose shape the engine defines; building the scheme editor first would mean inventing those shapes by hand and reconciling them later. The engine has no dependencies — no database, no auth, no UI — so it also reaches a green test suite fastest. Nothing user-visible ships at the end of this plan; the payoff is that the next one has a validated contract to build against.

## Global Constraints

- **Purity is the point.** Nothing in `packages/core` may import `node:*`, call `Date.now()`, `new Date()`, `Math.random()`, or perform I/O. A test asserts this by reading the built source.
- **Weight is always kilograms**, stored and computed as `number`. Pounds are a display conversion elsewhere and must not appear in this package.
- `history` arrives **most-recent-first** and contains **working sets only**. The caller filters warmups; the engine never learns what a warmup is.
- Every weight the engine returns passes through `roundToIncrement(kg, plateIncrementKg, "down")`. A target nobody can load onto a bar is a bug.
- **No `any`.** No non-null assertions (`!`) on values derived from `history` — its emptiness is a real case, not an inconvenience.
- Exhaustiveness over `Scheme["kind"]` is enforced by a `never` check in the switch default, so adding a fifth scheme fails to compile rather than silently falling through.
- Exported names are the public API of this package and are consumed by `apps/api` and `apps/web`. Re-export everything from `packages/core/src/index.ts`.
- `pnpm --filter <pkg> run <script>` — always with `run`, or a name colliding with a pnpm builtin silently exits 0.
- Tests are table-driven where a rule has more than two cases. One `it()` per behaviour, named for the behaviour, not the function.

---

## File Structure

```
packages/schema/src/
├── scheme.ts            NEW  Zod schemas for the four schemes + scheme_config parsing
└── index.ts             MOD  re-export ./scheme.js

packages/core/src/
├── types.ts             NEW  Scheme, Performance, Target, LoggedSet
├── rounding.ts          NEW  roundToIncrement
├── oneRepMax.ts         NEW  epley1RM, isPersonalRecord
├── nextTarget.ts        NEW  the engine — one function, one switch, four branches
├── schemes/
│   ├── fixed.ts         NEW
│   ├── linear.ts        NEW  includes the deload-streak reader
│   ├── double.ts        NEW
│   └── rpe.ts           NEW
└── index.ts             MOD  re-export the public surface

packages/core/test/
├── rounding.test.ts     NEW
├── oneRepMax.test.ts    NEW
├── fixed.test.ts        NEW
├── linear.test.ts       NEW
├── double.test.ts       NEW
├── rpe.test.ts          NEW
└── purity.test.ts       NEW  asserts no clock/IO/randomness reached the source
```

One file per scheme rather than one large `nextTarget.ts`: each scheme's rule is independently reviewable, and the deload-streak logic in `linear.ts` is the only genuinely subtle piece in the package — it deserves to be readable on its own.

---

## Task 1: Package scaffolding and the scheme contract

**Files:**
- Modify: `packages/core/package.json`
- Create: `packages/core/vitest.config.ts`
- Create: `packages/core/src/types.ts`
- Create: `packages/schema/src/scheme.ts`
- Modify: `packages/schema/src/index.ts`
- Test: `packages/schema` types are exercised by later tasks; this task's gate is typecheck + the schema parsing test below
- Test: `packages/core/test/purity.test.ts`

**Interfaces:**
- Produces: `Scheme`, `SchemeFixed`, `SchemeLinear`, `SchemeDouble`, `SchemeRpe`, `LoggedSet`, `Performance`, `Target`, `NextTargetOptions` from `@podhod/core`; `schemeSchema`, `parseSchemeConfig` from `@podhod/schema`.

- [ ] **Step 1: Give `packages/core` a test runner**

`packages/core/package.json` — add the `test` script and vitest. It currently has only `typecheck`.

```json
{
  "name": "@podhod/core",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "devDependencies": { "vitest": "^3.0.0" }
}
```

No dependency on `@podhod/schema`: the engine owns its TypeScript types and never
parses anything itself — callers hand it an already-validated `Scheme`. Adding the
dependency "for symmetry" would make a pure computation package depend on a
validation library it never calls.

Run: `pnpm install`

- [ ] **Step 2: Write the types**

`packages/core/src/types.ts`:

```ts
/**
 * One prescription rule. The discriminant is `kind`; every consumer switches on
 * it, and the switch in nextTarget() has a `never` default so a fifth scheme
 * cannot be added without the compiler pointing at every place that must handle
 * it.
 */
export type SchemeFixed = {
  kind: "fixed";
  sets: number;
  reps: number;
  weightKg: number;
};

export type SchemeLinear = {
  kind: "linear";
  sets: number;
  reps: number;
  incrementKg: number;
  /** Consecutive failed sessions that trigger a deload. */
  failuresBeforeDeload: number;
  /** Fraction, not percent: 0.1 means drop the weight by ten per cent. */
  deloadPct: number;
};

export type SchemeDouble = {
  kind: "double";
  sets: number;
  repLow: number;
  repHigh: number;
  incrementKg: number;
};

export type SchemeRpe = {
  kind: "rpe";
  sets: number;
  reps: number;
  targetRpe: number;
  /** Fraction, not percent. */
  adjustPct: number;
};

export type Scheme = SchemeFixed | SchemeLinear | SchemeDouble | SchemeRpe;

/** One working set as it was actually performed. */
export type LoggedSet = { reps: number; weightKg: number; rpe?: number };

/**
 * One past session of one exercise. `targetWeightKg`/`targetReps` are what the
 * app asked for that day — snapshotted into workout_entries.planned at the time,
 * never recomputed — so "did I hit my target" stays answerable even after the
 * program is edited.
 */
export type Performance = {
  sets: LoggedSet[];
  targetWeightKg: number;
  targetReps: number;
};

/**
 * `needsBaseline` is a distinct shape rather than a nullable weight because the
 * UI does something completely different in that case: it asks for a starting
 * weight instead of rendering a target. Naive implementations return 0 kg here.
 */
export type Target =
  | { needsBaseline: true }
  | {
      needsBaseline: false;
      sets: number;
      reps: number;
      weightKg: number;
      /** Change against the previous session's target, in kg. Drives the chip. */
      delta: number;
      reason: "progressed" | "held" | "deloaded";
    };

export type NextTargetOptions = { plateIncrementKg: number };
```

- [ ] **Step 3: Write the Zod schemas**

`packages/schema/src/scheme.ts`:

```ts
import { z } from "zod";

/**
 * The wire and storage contract for program_exercises.scheme_config. The engine
 * in @podhod/core owns the TypeScript types; this owns validation, so the scheme
 * editor and the API agree on what a valid scheme is without either importing
 * the other's internals.
 *
 * Percentages are fractions (0.1 = 10%), never whole numbers. Storing 10 and
 * meaning 10% is how these values end up multiplied by a hundred somewhere
 * downstream.
 */
const positiveInt = z.number().int().positive();
const weight = z.number().positive();
const fraction = z.number().gt(0).lt(1);

export const schemeFixedSchema = z.object({
  kind: z.literal("fixed"),
  sets: positiveInt.max(20),
  reps: positiveInt.max(100),
  weightKg: weight.max(1000),
});

export const schemeLinearSchema = z.object({
  kind: z.literal("linear"),
  sets: positiveInt.max(20),
  reps: positiveInt.max(100),
  incrementKg: weight.max(50),
  failuresBeforeDeload: positiveInt.max(10),
  deloadPct: fraction,
});

export const schemeDoubleSchema = z
  .object({
    kind: z.literal("double"),
    sets: positiveInt.max(20),
    repLow: positiveInt.max(100),
    repHigh: positiveInt.max(100),
    incrementKg: weight.max(50),
  })
  .refine((s) => s.repHigh > s.repLow, {
    message: "repHigh must be greater than repLow",
    path: ["repHigh"],
  });

export const schemeRpeSchema = z.object({
  kind: z.literal("rpe"),
  sets: positiveInt.max(20),
  reps: positiveInt.max(100),
  // RPE is a 1-10 scale and half-points are meaningful ("RPE 8.5"), so this is
  // deliberately not an integer.
  targetRpe: z.number().min(1).max(10),
  adjustPct: fraction,
});

export const schemeSchema = z.discriminatedUnion("kind", [
  schemeFixedSchema,
  schemeLinearSchema,
  schemeDoubleSchema,
  schemeRpeSchema,
]);

export type SchemeInput = z.infer<typeof schemeSchema>;

/**
 * scheme_config is a TEXT column holding JSON, so reading it has two failure
 * modes — malformed JSON and well-formed JSON of the wrong shape. Both return
 * the same discriminated result rather than throwing, because a single corrupt
 * row must not take down a whole program's page.
 */
export function parseSchemeConfig(
  raw: string,
): { ok: true; scheme: SchemeInput } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "scheme_config is not valid JSON" };
  }
  const result = schemeSchema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    return { ok: false, error: `scheme_config ${issue?.path.join(".") || ""}`.trim() };
  }
  return { ok: true, scheme: result.data };
}
```

Add to `packages/schema/src/index.ts`:

```ts
export * from "./scheme.js";
```

- [ ] **Step 4: Write the purity test**

`packages/core/test/purity.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The engine's testability rests entirely on it having no clock, no I/O and no
 * randomness — that is what lets every rule be asserted with a literal input and
 * a literal expectation. It is also exactly the kind of property that erodes:
 * one `new Date()` added for a "quick" default and the package needs mocks
 * forever. This reads the source rather than the behaviour, because a clock
 * added down an untested branch would not show up any other way.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith(".ts") ? [full] : [];
  });
}

const FORBIDDEN = [
  { pattern: /\bnew Date\b/, why: "a clock" },
  { pattern: /\bDate\.now\b/, why: "a clock" },
  { pattern: /\bMath\.random\b/, why: "randomness" },
  { pattern: /from ["']node:/, why: "a Node built-in" },
  { pattern: /\bfetch\s*\(/, why: "network I/O" },
];

describe("packages/core stays pure", () => {
  const files = sourceFiles(join(import.meta.dirname, "..", "src"));

  it("finds source files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const { pattern, why } of FORBIDDEN) {
    it(`contains no ${why} (${pattern.source})`, () => {
      const offenders = files.filter((f) => pattern.test(readFileSync(f, "utf8")));
      expect(offenders).toEqual([]);
    });
  }
});
```

- [ ] **Step 5: Run the tests and typecheck**

Run: `pnpm --filter @podhod/core run test && pnpm typecheck`
Expected: purity tests PASS (6 assertions — one per forbidden pattern, plus the
guard that the file list is not empty), typecheck clean across all packages.

- [ ] **Step 6: Commit**

```bash
git add packages/core packages/schema pnpm-lock.yaml
git commit -m "Add the progression engine's types and scheme validation contract"
```

---

## Task 2: Loadable weights

**Files:**
- Create: `packages/core/src/rounding.ts`
- Test: `packages/core/test/rounding.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `roundToIncrement(kg: number, incrementKg: number, mode?: "down" | "nearest"): number`

- [ ] **Step 1: Write the failing test**

`packages/core/test/rounding.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { roundToIncrement } from "../src/rounding.js";

describe("roundToIncrement", () => {
  it.each([
    // [kg, increment, mode, expected]
    [82.4, 2.5, "down", 80],
    [82.5, 2.5, "down", 82.5],
    [82.6, 2.5, "down", 82.5],
    [100, 2.5, "down", 100],
    [72, 2.5, "down", 70],
    [61.25, 1.25, "down", 61.25],
    [5, 5, "down", 5],
    [4.9, 5, "down", 0],
  ] as const)("rounds %s kg down to a multiple of %s → %s", (kg, inc, mode, expected) => {
    expect(roundToIncrement(kg, inc, mode)).toBe(expected);
  });

  /**
   * The whole reason this function exists rather than a bare Math.floor: in
   * IEEE-754, quotients that are mathematically whole are routinely 32.99999...
   * or 33.00000...4, and flooring those silently drops a plate. Every value here
   * is one that a naive implementation gets wrong.
   */
  it.each([
    [7.5, 2.5, 7.5],
    [0.3, 0.1, 0.3],
    [16.8, 1.2, 16.8],
    [2.4, 0.8, 2.4],
  ] as const)("does not lose an increment to float error: %s / %s", (kg, inc, expected) => {
    expect(roundToIncrement(kg, inc, "down")).toBe(expected);
  });

  it("rounds to nearest when asked", () => {
    expect(roundToIncrement(82.4, 2.5, "nearest")).toBe(82.5);
    expect(roundToIncrement(81, 2.5, "nearest")).toBe(80);
  });

  it("defaults to rounding down, because a target must be loadable", () => {
    expect(roundToIncrement(82.4, 2.5)).toBe(80);
  });

  it("never returns a negative weight", () => {
    expect(roundToIncrement(-5, 2.5, "down")).toBe(0);
  });

  it.each([0, -1, Number.NaN])("rejects a %s increment rather than dividing by it", (inc) => {
    expect(() => roundToIncrement(100, inc)).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @podhod/core run test rounding`
Expected: FAIL — cannot resolve `../src/rounding.js`.

- [ ] **Step 3: Implement**

`packages/core/src/rounding.ts`:

```ts
/**
 * Snap a computed weight to something that can actually be loaded.
 *
 * Rounding is DOWN by default and that default is load-bearing: a target of
 * 82.4 kg on 2.5 kg plates has to become 80, not 82.5, because rounding up
 * hands someone a weight they were never prescribed and, on a deload, defeats
 * the deload.
 *
 * The epsilon snap is not defensive noise. `7.5 / 2.5` is exactly 3 in IEEE-754,
 * but plenty of realistic pairs are not — `16.8 / 1.2` is 13.999999999999998,
 * and `Math.floor` of that silently removes a full increment. Rounding the
 * quotient to nine decimal places first is well inside any real tolerance
 * (a nanogram) and well outside float noise.
 */
export function roundToIncrement(
  kg: number,
  incrementKg: number,
  mode: "down" | "nearest" = "down",
): number {
  if (!Number.isFinite(incrementKg) || incrementKg <= 0) {
    throw new RangeError(`increment must be a positive number, got ${incrementKg}`);
  }
  if (!Number.isFinite(kg) || kg <= 0) return 0;

  const quotient = Math.round((kg / incrementKg) * 1e9) / 1e9;
  const steps = mode === "down" ? Math.floor(quotient) : Math.round(quotient);
  // toFixed then back: 33 * 2.5 is exact, but 3 * 0.1 is 0.30000000000000004,
  // and that value would then be rendered to the user.
  return Number((steps * incrementKg).toFixed(6));
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @podhod/core run test rounding`
Expected: PASS, 18 assertions.

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "Round computed weights to something loadable on a real bar"
```

---

## Task 3: The `fixed` scheme and the baseline contract

**Files:**
- Create: `packages/core/src/schemes/fixed.ts`
- Create: `packages/core/src/nextTarget.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/fixed.test.ts`

**Interfaces:**
- Consumes: `roundToIncrement`, all types from Task 1.
- Produces: `nextTarget(scheme: Scheme, history: Performance[], options: NextTargetOptions): Target`

**Decision this task settles:** the design doc says "with no history the engine returns `needsBaseline: true`". That is true of three schemes and false of `fixed`, whose weight is configured rather than derived. `fixed` therefore never asks for a baseline. This distinction is asserted, not assumed.

- [ ] **Step 1: Write the failing test**

`packages/core/test/fixed.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { nextTarget } from "../src/nextTarget.js";
import type { Performance, SchemeFixed } from "../src/types.js";

const scheme: SchemeFixed = { kind: "fixed", sets: 3, reps: 10, weightKg: 60 };
const opts = { plateIncrementKg: 2.5 };

const session = (weightKg: number, reps: number, count = 3): Performance => ({
  sets: Array.from({ length: count }, () => ({ reps, weightKg })),
  targetWeightKg: weightKg,
  targetReps: reps,
});

describe("fixed scheme", () => {
  it("prescribes the configured weight with no history, rather than asking for a baseline", () => {
    // The distinction from every other scheme: nothing here is derived from a
    // previous session, so there is nothing to establish.
    expect(nextTarget(scheme, [], opts)).toEqual({
      needsBaseline: false,
      sets: 3,
      reps: 10,
      weightKg: 60,
      delta: 0,
      reason: "held",
    });
  });

  it("keeps prescribing the same thing regardless of how the last session went", () => {
    const target = nextTarget(scheme, [session(60, 4)], opts);
    expect(target).toMatchObject({ weightKg: 60, reps: 10, reason: "held" });
  });

  it("reports the delta against the last session's target, so an edited scheme is visible", () => {
    // The user raised the configured weight from 55 to 60 between sessions; the
    // chip should say +5, not 0.
    expect(nextTarget(scheme, [session(55, 10)], opts)).toMatchObject({
      weightKg: 60,
      delta: 5,
    });
  });

  it("rounds an unloadable configured weight down", () => {
    const odd: SchemeFixed = { ...scheme, weightKg: 82.4 };
    expect(nextTarget(odd, [], opts)).toMatchObject({ weightKg: 80 });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @podhod/core run test fixed`
Expected: FAIL — cannot resolve `../src/nextTarget.js`.

- [ ] **Step 3: Implement the fixed branch and the dispatcher**

`packages/core/src/schemes/fixed.ts`:

```ts
import { roundToIncrement } from "../rounding.js";
import type { NextTargetOptions, Performance, SchemeFixed, Target } from "../types.js";

/**
 * The only scheme that derives nothing from history. It still reports a delta,
 * because the configured weight can be edited between sessions and a silent
 * change is worse than a visible one.
 */
export function fixedTarget(
  scheme: SchemeFixed,
  history: Performance[],
  { plateIncrementKg }: NextTargetOptions,
): Target {
  const weightKg = roundToIncrement(scheme.weightKg, plateIncrementKg, "down");
  const last = history[0];
  return {
    needsBaseline: false,
    sets: scheme.sets,
    reps: scheme.reps,
    weightKg,
    delta: last ? weightKg - last.targetWeightKg : 0,
    reason: "held",
  };
}
```

`packages/core/src/nextTarget.ts`:

```ts
import { fixedTarget } from "./schemes/fixed.js";
import type { NextTargetOptions, Performance, Scheme, Target } from "./types.js";

/**
 * Compute what to lift next.
 *
 * `history` is most-recent-first and holds working sets only — the caller drops
 * warmups, so this function never has to know what one is. Ordering is the only
 * temporal information here; there is deliberately no clock, which is what makes
 * every rule below assertable with a literal input and a literal expectation.
 */
export function nextTarget(
  scheme: Scheme,
  history: Performance[],
  options: NextTargetOptions,
): Target {
  switch (scheme.kind) {
    case "fixed":
      return fixedTarget(scheme, history, options);
    default: {
      // Adding a fifth scheme fails to compile here rather than falling through
      // to a wrong answer at runtime.
      const unreachable: never = scheme;
      throw new Error(`unhandled scheme: ${JSON.stringify(unreachable)}`);
    }
  }
}
```

> Note: until Tasks 4-6 land, `linear`/`double`/`rpe` hit the `never` branch and the file will not typecheck. Add the three remaining cases as those tasks implement them; do not stub them with placeholder returns, which would let a wrong answer ship if a later task were skipped.

Add to `packages/core/src/index.ts`:

```ts
export * from "./types.js";
export * from "./rounding.js";
export * from "./nextTarget.js";
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @podhod/core run test fixed`
Expected: PASS, 4 assertions. Typecheck will report the unhandled scheme kinds until Task 6 — that is expected and is why the commit below runs tests, not typecheck.

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "Compute fixed-scheme targets, and settle when a baseline is needed"
```

---

## Task 4: The `linear` scheme, including deloads

**Files:**
- Create: `packages/core/src/schemes/linear.ts`
- Modify: `packages/core/src/nextTarget.ts`
- Test: `packages/core/test/linear.test.ts`

**Interfaces:**
- Consumes: `roundToIncrement`, types.
- Produces: `linearTarget`, and `sessionSucceeded(perf, requiredSets)` exported for reuse by `double`.

**The subtle part of this plan.** "Reset the streak on deload" cannot be done by counting consecutive failures, because after a deload the older failures are still sitting in `history`. They must be excluded, and the only evidence available is the data itself: a session whose target weight is *below* the session before it is a session where a deload was applied. Counting stops there.

- [ ] **Step 1: Write the failing test**

`packages/core/test/linear.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { nextTarget } from "../src/nextTarget.js";
import type { Performance, SchemeLinear } from "../src/types.js";

const scheme: SchemeLinear = {
  kind: "linear",
  sets: 3,
  reps: 5,
  incrementKg: 2.5,
  failuresBeforeDeload: 3,
  deloadPct: 0.1,
};
const opts = { plateIncrementKg: 2.5 };

/** A session where every set hit the target. */
const hit = (weightKg: number, reps = 5, sets = 3): Performance => ({
  sets: Array.from({ length: sets }, () => ({ reps, weightKg })),
  targetWeightKg: weightKg,
  targetReps: reps,
});

/** A session at `weightKg` where the last set fell short. */
const missed = (weightKg: number, shortReps = 3): Performance => ({
  sets: [
    { reps: 5, weightKg },
    { reps: 5, weightKg },
    { reps: shortReps, weightKg },
  ],
  targetWeightKg: weightKg,
  targetReps: 5,
});

describe("linear scheme", () => {
  it("asks for a baseline when there is no history, rather than guessing a weight", () => {
    expect(nextTarget(scheme, [], opts)).toEqual({ needsBaseline: true });
  });

  it("adds the increment when every set hit the target", () => {
    expect(nextTarget(scheme, [hit(100)], opts)).toEqual({
      needsBaseline: false,
      sets: 3,
      reps: 5,
      weightKg: 102.5,
      delta: 2.5,
      reason: "progressed",
    });
  });

  it("holds the weight after a single miss", () => {
    expect(nextTarget(scheme, [missed(100)], opts)).toMatchObject({
      weightKg: 100,
      delta: 0,
      reason: "held",
    });
  });

  it("still holds at one short of the deload threshold", () => {
    const history = [missed(100), missed(100)];
    expect(nextTarget(scheme, history, opts)).toMatchObject({
      weightKg: 100,
      reason: "held",
    });
  });

  it("deloads on the third consecutive miss", () => {
    const history = [missed(100), missed(100), missed(100)];
    // 100 × 0.9 = 90, already a multiple of 2.5.
    expect(nextTarget(scheme, history, opts)).toMatchObject({
      weightKg: 90,
      delta: -10,
      reason: "deloaded",
    });
  });

  it("rounds a deload down to a loadable weight", () => {
    const history = [missed(102.5), missed(102.5), missed(102.5)];
    // 102.5 × 0.9 = 92.25 → down to 90 on 2.5 kg plates.
    expect(nextTarget(scheme, history, opts)).toMatchObject({
      weightKg: 90,
      reason: "deloaded",
    });
  });

  /**
   * The case that makes this more than a counter. History still contains the
   * three misses that CAUSED the deload; if they were counted again, every
   * session after a deload would deload again, walking the weight to zero.
   * The deload is visible in the data as a drop in target weight, and counting
   * stops there.
   */
  it("does not re-count the misses that caused a previous deload", () => {
    const history = [
      missed(90), // first miss at the post-deload weight
      hit(90), // the deload session itself: target dropped 100 → 90
      missed(100),
      missed(100),
      missed(100),
    ];
    expect(nextTarget(scheme, history, opts)).toMatchObject({
      weightKg: 90,
      reason: "held",
    });
  });

  /**
   * The harder version of the same case, and the one that actually exercises the
   * streak reset: the deload session was ALSO missed, so nothing succeeded
   * anywhere in this history. A plain consecutive-failure count sees five misses
   * and deloads again immediately — and would keep deloading every session,
   * walking the weight toward zero. Only the weight drop between the deload
   * session and the one before it stops the count.
   */
  it("stops counting at the deload even when the deload session was itself missed", () => {
    const history = [
      missed(90), // post-deload, missed again — streak of one, not four
      missed(100),
      missed(100),
      missed(100),
    ];
    expect(nextTarget(scheme, history, opts)).toMatchObject({
      weightKg: 90,
      reason: "held",
    });
  });

  it("counts a session with fewer working sets than prescribed as a miss", () => {
    // Three sets were asked for, two were done, both at full reps.
    const short: Performance = {
      sets: [
        { reps: 5, weightKg: 100 },
        { reps: 5, weightKg: 100 },
      ],
      targetWeightKg: 100,
      targetReps: 5,
    };
    expect(nextTarget(scheme, [short], opts)).toMatchObject({ reason: "held" });
  });

  it("counts a session lifted below the target weight as a miss, even at full reps", () => {
    const light: Performance = {
      sets: Array.from({ length: 3 }, () => ({ reps: 5, weightKg: 95 })),
      targetWeightKg: 100,
      targetReps: 5,
    };
    expect(nextTarget(scheme, [light], opts)).toMatchObject({ reason: "held" });
  });

  it("treats extra reps as a hit, not a failure", () => {
    expect(nextTarget(scheme, [hit(100, 7)], opts)).toMatchObject({
      reason: "progressed",
    });
  });

  it("treats a logged session with no working sets as a miss rather than crashing", () => {
    const empty: Performance = { sets: [], targetWeightKg: 100, targetReps: 5 };
    expect(nextTarget(scheme, [empty], opts)).toMatchObject({ reason: "held" });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @podhod/core run test linear`
Expected: FAIL — cannot resolve `../src/schemes/linear.js` (via nextTarget).

- [ ] **Step 3: Implement**

`packages/core/src/schemes/linear.ts`:

```ts
import { roundToIncrement } from "../rounding.js";
import type { NextTargetOptions, Performance, SchemeLinear, Target } from "../types.js";

/**
 * A session counts as a hit only if the prescribed number of working sets were
 * all performed at or above the target weight and target reps. Doing more is a
 * hit; doing fewer sets, lighter weight, or fewer reps is not.
 */
export function sessionSucceeded(perf: Performance, requiredSets: number): boolean {
  if (perf.sets.length < requiredSets) return false;
  return perf.sets.every(
    (s) => s.reps >= perf.targetReps && s.weightKg >= perf.targetWeightKg,
  );
}

/**
 * How many consecutive recent sessions were failures — stopping at a deload.
 *
 * History is most-recent-first, and it still contains the failures that caused
 * any earlier deload. Counting them again would deload on every subsequent
 * session and walk the weight to zero. There is no stored "deload happened"
 * flag to consult, but there does not need to be: a deload is visible as a
 * session whose target weight is below that of the session before it, so the
 * count stops as soon as one is found.
 */
function failureStreak(history: Performance[], requiredSets: number): number {
  let streak = 0;
  for (let i = 0; i < history.length; i++) {
    const session = history[i];
    if (!session || sessionSucceeded(session, requiredSets)) break;
    streak++;
    const older = history[i + 1];
    if (older && session.targetWeightKg < older.targetWeightKg) break;
  }
  return streak;
}

export function linearTarget(
  scheme: SchemeLinear,
  history: Performance[],
  { plateIncrementKg }: NextTargetOptions,
): Target {
  const last = history[0];
  if (!last) return { needsBaseline: true };

  const base = last.targetWeightKg;
  const round = (kg: number) => roundToIncrement(kg, plateIncrementKg, "down");

  if (sessionSucceeded(last, scheme.sets)) {
    const weightKg = round(base + scheme.incrementKg);
    return {
      needsBaseline: false,
      sets: scheme.sets,
      reps: scheme.reps,
      weightKg,
      delta: weightKg - base,
      reason: "progressed",
    };
  }

  if (failureStreak(history, scheme.sets) >= scheme.failuresBeforeDeload) {
    const weightKg = round(base * (1 - scheme.deloadPct));
    return {
      needsBaseline: false,
      sets: scheme.sets,
      reps: scheme.reps,
      weightKg,
      delta: weightKg - base,
      reason: "deloaded",
    };
  }

  const weightKg = round(base);
  return {
    needsBaseline: false,
    sets: scheme.sets,
    reps: scheme.reps,
    weightKg,
    delta: weightKg - base,
    reason: "held",
  };
}
```

Add the case to `packages/core/src/nextTarget.ts`:

```ts
    case "linear":
      return linearTarget(scheme, history, options);
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @podhod/core run test linear`
Expected: PASS, 12 assertions — including both streak-reset cases, which fail
against any implementation that counts consecutive failures without looking for
the weight drop.

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "Compute linear targets, and stop deloads from compounding on themselves"
```

---

## Task 5: The `double` scheme

**Files:**
- Create: `packages/core/src/schemes/double.ts`
- Modify: `packages/core/src/nextTarget.ts`
- Test: `packages/core/test/double.test.ts`

**Interfaces:**
- Consumes: `roundToIncrement`, `sessionSucceeded` is *not* reused here — double progression's success condition is reaching `repHigh`, not the session's own recorded target.

- [ ] **Step 1: Write the failing test**

`packages/core/test/double.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { nextTarget } from "../src/nextTarget.js";
import type { Performance, SchemeDouble } from "../src/types.js";

const scheme: SchemeDouble = {
  kind: "double",
  sets: 3,
  repLow: 8,
  repHigh: 12,
  incrementKg: 2.5,
};
const opts = { plateIncrementKg: 2.5 };

const session = (weightKg: number, reps: number[]): Performance => ({
  sets: reps.map((r) => ({ reps: r, weightKg })),
  targetWeightKg: weightKg,
  targetReps: reps[0] ?? 0,
});

describe("double progression", () => {
  it("asks for a baseline when there is no history", () => {
    expect(nextTarget(scheme, [], opts)).toEqual({ needsBaseline: true });
  });

  it("adds weight and drops back to the bottom of the range once every set reaches the top", () => {
    expect(nextTarget(scheme, [session(50, [12, 12, 12])], opts)).toEqual({
      needsBaseline: false,
      sets: 3,
      reps: 8,
      weightKg: 52.5,
      delta: 2.5,
      reason: "progressed",
    });
  });

  /**
   * The rule that makes double progression work: you chase the WEAKEST set, not
   * the average and not the best. Targeting one more than the lowest is what
   * actually drags the whole range upward; targeting the best set would let the
   * weakest lag indefinitely.
   */
  it("holds the weight and chases the weakest set by one rep", () => {
    expect(nextTarget(scheme, [session(50, [12, 10, 9])], opts)).toMatchObject({
      weightKg: 50,
      reps: 10,
      delta: 0,
      reason: "held",
    });
  });

  it("does not push the rep target past the top of the range", () => {
    // Lowest set was 12, +1 would be 13, which is outside the range.
    expect(nextTarget(scheme, [session(50, [12, 12, 12])], opts)).toMatchObject({
      reps: 8,
    });
  });

  it("caps the chased rep target at repHigh when the weakest set is one short", () => {
    expect(nextTarget(scheme, [session(50, [12, 12, 11])], opts)).toMatchObject({
      weightKg: 50,
      reps: 12,
      reason: "held",
    });
  });

  it("counts fewer sets than prescribed as not having reached the top", () => {
    expect(nextTarget(scheme, [session(50, [12, 12])], opts)).toMatchObject({
      weightKg: 50,
      reason: "held",
    });
  });

  it("starts at the bottom of the range when the weakest set is below it", () => {
    expect(nextTarget(scheme, [session(50, [8, 6, 5])], opts)).toMatchObject({
      weightKg: 50,
      reps: 8,
    });
  });

  it("treats a logged session with no working sets as a hold at the bottom of the range", () => {
    const empty: Performance = { sets: [], targetWeightKg: 50, targetReps: 8 };
    expect(nextTarget(scheme, [empty], opts)).toMatchObject({
      weightKg: 50,
      reps: 8,
      reason: "held",
    });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @podhod/core run test double`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`packages/core/src/schemes/double.ts`:

```ts
import { roundToIncrement } from "../rounding.js";
import type { NextTargetOptions, Performance, SchemeDouble, Target } from "../types.js";

/**
 * Double progression holds the weight until the rep range is filled out at every
 * set, then adds weight and resets to the bottom of the range.
 *
 * Success is measured against `repHigh` rather than against the session's own
 * recorded target, unlike the linear scheme: the target rep count moves within
 * the range from session to session, so it is not the thing that decides whether
 * the weight goes up.
 */
export function doubleTarget(
  scheme: SchemeDouble,
  history: Performance[],
  { plateIncrementKg }: NextTargetOptions,
): Target {
  const last = history[0];
  if (!last) return { needsBaseline: true };

  const base = last.targetWeightKg;
  const round = (kg: number) => roundToIncrement(kg, plateIncrementKg, "down");

  const filledOut =
    last.sets.length >= scheme.sets && last.sets.every((s) => s.reps >= scheme.repHigh);

  if (filledOut) {
    const weightKg = round(base + scheme.incrementKg);
    return {
      needsBaseline: false,
      sets: scheme.sets,
      reps: scheme.repLow,
      weightKg,
      delta: weightKg - base,
      reason: "progressed",
    };
  }

  // Chase the weakest set, not the average: one more rep than the worst set is
  // what actually drags the range upward. A session with nothing logged has no
  // weakest set, so it restarts at the bottom of the range.
  const lowest = last.sets.length
    ? Math.min(...last.sets.map((s) => s.reps))
    : scheme.repLow - 1;
  const reps = Math.max(scheme.repLow, Math.min(scheme.repHigh, lowest + 1));

  const weightKg = round(base);
  return {
    needsBaseline: false,
    sets: scheme.sets,
    reps,
    weightKg,
    delta: weightKg - base,
    reason: "held",
  };
}
```

Add the case to `nextTarget.ts`:

```ts
    case "double":
      return doubleTarget(scheme, history, options);
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @podhod/core run test double`
Expected: PASS, 8 assertions.

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "Compute double-progression targets by chasing the weakest set"
```

---

## Task 6: The `rpe` scheme

**Files:**
- Create: `packages/core/src/schemes/rpe.ts`
- Modify: `packages/core/src/nextTarget.ts`
- Test: `packages/core/test/rpe.test.ts`

**Decision this task settles:** RPE is optional on `LoggedSet`. If a session recorded none, the scheme has nothing to judge and holds — it does not treat missing data as "easy" and add weight.

- [ ] **Step 1: Write the failing test**

`packages/core/test/rpe.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { nextTarget } from "../src/nextTarget.js";
import type { Performance, SchemeRpe } from "../src/types.js";

const scheme: SchemeRpe = {
  kind: "rpe",
  sets: 3,
  reps: 5,
  targetRpe: 8,
  adjustPct: 0.05,
};
const opts = { plateIncrementKg: 2.5 };

const session = (weightKg: number, rpes: (number | undefined)[]): Performance => ({
  sets: rpes.map((rpe) => ({ reps: 5, weightKg, rpe })),
  targetWeightKg: weightKg,
  targetReps: 5,
});

describe("rpe scheme", () => {
  it("asks for a baseline when there is no history", () => {
    expect(nextTarget(scheme, [], opts)).toEqual({ needsBaseline: true });
  });

  it("adds weight when the session was comfortably below the target effort", () => {
    // mean 6.5, target 8 → below 8 − 1, so it was too easy.
    // 100 × 1.05 = 105.
    expect(nextTarget(scheme, [session(100, [6, 6.5, 7])], opts)).toMatchObject({
      weightKg: 105,
      delta: 5,
      reason: "progressed",
    });
  });

  it("reduces weight when the session was above the target effort", () => {
    // mean 9, target 8 → above 8 + 0.5. 100 × 0.95 = 95.
    expect(nextTarget(scheme, [session(100, [8.5, 9, 9.5])], opts)).toMatchObject({
      weightKg: 95,
      delta: -5,
      reason: "deloaded",
    });
  });

  it("holds inside the dead band around the target", () => {
    // mean 8 — exactly on target.
    expect(nextTarget(scheme, [session(100, [7.5, 8, 8.5])], opts)).toMatchObject({
      weightKg: 100,
      delta: 0,
      reason: "held",
    });
  });

  it("holds at the exact lower edge rather than progressing on it", () => {
    // mean exactly 7 = targetRpe − 1. The rule is "below", not "at or below".
    expect(nextTarget(scheme, [session(100, [7, 7, 7])], opts)).toMatchObject({
      reason: "held",
    });
  });

  it("holds at the exact upper edge rather than deloading on it", () => {
    // mean exactly 8.5 = targetRpe + 0.5.
    expect(nextTarget(scheme, [session(100, [8.5, 8.5, 8.5])], opts)).toMatchObject({
      reason: "held",
    });
  });

  /**
   * RPE is optional per set. A session with none recorded carries no information
   * about effort, and the safe reading of no information is not "that was easy".
   */
  it("holds when no set carried an RPE, rather than reading silence as easy", () => {
    expect(nextTarget(scheme, [session(100, [undefined, undefined, undefined])], opts))
      .toMatchObject({ weightKg: 100, reason: "held" });
  });

  it("averages only the sets that recorded an RPE", () => {
    // Recorded: 6 and 6. Mean 6, well below 7 → progress.
    expect(nextTarget(scheme, [session(100, [6, undefined, 6])], opts)).toMatchObject({
      reason: "progressed",
    });
  });

  it("rounds an adjusted weight down to something loadable", () => {
    // 102.5 × 1.05 = 107.625 → 107.5 on 2.5 kg plates.
    expect(nextTarget(scheme, [session(102.5, [6, 6, 6])], opts)).toMatchObject({
      weightKg: 107.5,
    });
  });

  it("treats a logged session with no working sets as a hold", () => {
    const empty: Performance = { sets: [], targetWeightKg: 100, targetReps: 5 };
    expect(nextTarget(scheme, [empty], opts)).toMatchObject({ reason: "held" });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @podhod/core run test rpe`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`packages/core/src/schemes/rpe.ts`:

```ts
import { roundToIncrement } from "../rounding.js";
import type { NextTargetOptions, Performance, SchemeRpe, Target } from "../types.js";

/** Dead band above the target, in RPE points, before the weight comes down. */
const UPPER_TOLERANCE = 0.5;
/** Dead band below the target, in RPE points, before the weight goes up. */
const LOWER_TOLERANCE = 1;

/**
 * Autoregulation: adjust by how hard the last session actually felt rather than
 * by a fixed increment. The band around the target exists so that normal
 * day-to-day variation in perceived effort does not move the weight every
 * session.
 *
 * RPE is optional on a logged set, and a session that recorded none is treated
 * as a hold. Reading absent effort data as "that was easy" and adding weight is
 * the one wrong answer here.
 */
export function rpeTarget(
  scheme: SchemeRpe,
  history: Performance[],
  { plateIncrementKg }: NextTargetOptions,
): Target {
  const last = history[0];
  if (!last) return { needsBaseline: true };

  const base = last.targetWeightKg;
  const round = (kg: number) => roundToIncrement(kg, plateIncrementKg, "down");

  const rpes = last.sets
    .map((s) => s.rpe)
    .filter((rpe): rpe is number => typeof rpe === "number");

  const held = (): Target => ({
    needsBaseline: false,
    sets: scheme.sets,
    reps: scheme.reps,
    weightKg: round(base),
    delta: round(base) - base,
    reason: "held",
  });

  if (rpes.length === 0) return held();

  const mean = rpes.reduce((sum, rpe) => sum + rpe, 0) / rpes.length;

  if (mean < scheme.targetRpe - LOWER_TOLERANCE) {
    const weightKg = round(base * (1 + scheme.adjustPct));
    return {
      needsBaseline: false,
      sets: scheme.sets,
      reps: scheme.reps,
      weightKg,
      delta: weightKg - base,
      reason: "progressed",
    };
  }

  if (mean > scheme.targetRpe + UPPER_TOLERANCE) {
    const weightKg = round(base * (1 - scheme.adjustPct));
    return {
      needsBaseline: false,
      sets: scheme.sets,
      reps: scheme.reps,
      weightKg,
      delta: weightKg - base,
      reason: "deloaded",
    };
  }

  return held();
}
```

Add the final case to `nextTarget.ts`:

```ts
    case "rpe":
      return rpeTarget(scheme, history, options);
```

- [ ] **Step 4: Run the whole suite and typecheck**

Run: `pnpm --filter @podhod/core run test && pnpm typecheck`
Expected: all tests PASS; typecheck now clean, because the `never` default is finally unreachable for every member of the union.

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "Compute RPE targets, holding when a session recorded no effort"
```

---

## Task 7: Estimated one-rep max and personal records

**Files:**
- Create: `packages/core/src/oneRepMax.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/oneRepMax.test.ts`

**Interfaces:**
- Produces: `epley1RM(weightKg, reps): number`, `bestE1RM(sets: LoggedSet[]): number`, `isPersonalRecord(candidate, priorBest): boolean`

Per the design doc, PRs are **computed, never stored** — one indexed query over `set_logs` plus these functions, rather than a `personal_records` table that would be a cache with nothing to gain from caching.

- [ ] **Step 1: Write the failing test**

`packages/core/test/oneRepMax.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { bestE1RM, epley1RM, isPersonalRecord } from "../src/oneRepMax.js";

describe("epley1RM", () => {
  it("estimates a one-rep max from a multi-rep set", () => {
    // 100 × (1 + 5/30) = 116.666…
    expect(epley1RM(100, 5)).toBeCloseTo(116.667, 3);
  });

  it("ranks a heavier set above a lighter one at equal reps", () => {
    expect(epley1RM(105, 5)).toBeGreaterThan(epley1RM(100, 5));
  });

  it("ranks more reps above fewer at equal weight", () => {
    expect(epley1RM(100, 8)).toBeGreaterThan(epley1RM(100, 5));
  });

  it("returns zero for a set that was not performed", () => {
    expect(epley1RM(100, 0)).toBe(0);
    expect(epley1RM(0, 5)).toBe(0);
  });
});

describe("bestE1RM", () => {
  it("takes the best set, which is not always the heaviest", () => {
    // 100×5 → 116.7 beats 105×3 → 115.5, despite the lighter bar.
    expect(bestE1RM([
      { weightKg: 105, reps: 3 },
      { weightKg: 100, reps: 5 },
    ])).toBeCloseTo(116.667, 3);
  });

  it("returns zero for an empty set list rather than -Infinity", () => {
    // Math.max() with no arguments is -Infinity, which would then be stored or
    // rendered.
    expect(bestE1RM([])).toBe(0);
  });
});

describe("isPersonalRecord", () => {
  it("is a record when it beats everything before it", () => {
    expect(isPersonalRecord({ weightKg: 100, reps: 5 }, 110)).toBe(true);
  });

  it("is not a record when it merely equals the prior best", () => {
    // Repeating your best is not a new record.
    expect(isPersonalRecord({ weightKg: 100, reps: 5 }, epley1RM(100, 5))).toBe(false);
  });

  it("is a record when there is no prior best at all", () => {
    expect(isPersonalRecord({ weightKg: 60, reps: 1 }, 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @podhod/core run test oneRepMax`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`packages/core/src/oneRepMax.ts`:

```ts
import type { LoggedSet } from "./types.js";

/**
 * Epley's estimate: weight × (1 + reps / 30).
 *
 * Used only to rank sets against one another, never presented as a number the
 * user should attempt. That matters because Epley returns weight × 1.033 for a
 * single rep rather than the weight itself — harmless for ordering, misleading
 * as a prescription.
 */
export function epley1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  return weightKg * (1 + reps / 30);
}

/**
 * The best estimated max among a group of sets. Not simply the heaviest set:
 * 100 kg × 5 estimates higher than 105 kg × 3, which is the entire reason for
 * estimating rather than comparing bar weights.
 *
 * Callers pass working sets only — warmups are excluded upstream, per the same
 * rule the progression engine follows.
 */
export function bestE1RM(sets: LoggedSet[]): number {
  // Math.max() of nothing is -Infinity, which would propagate into a stored or
  // rendered value.
  if (sets.length === 0) return 0;
  return Math.max(...sets.map((s) => epley1RM(s.weightKg, s.reps)));
}

/**
 * Strictly greater: repeating your best is not a new record. `priorBest` is the
 * best estimated max over every earlier working set for this user and exercise —
 * one indexed read, thanks to set_logs carrying denormalized user_id and
 * exercise_id.
 */
export function isPersonalRecord(candidate: LoggedSet, priorBest: number): boolean {
  return epley1RM(candidate.weightKg, candidate.reps) > priorBest;
}
```

Add to `packages/core/src/index.ts`:

```ts
export * from "./oneRepMax.js";
```

- [ ] **Step 4: Run the full suite, typecheck, and the workspace tests**

Run: `pnpm --filter @podhod/core run test && pnpm typecheck && pnpm test`
Expected: core tests PASS; every other package's tests still PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "Estimate one-rep maxes and detect personal records without storing them"
```

---

## Task 8: Wire the package into the workspace

**Files:**
- Modify: `.github/workflows/ci.yml` (only if `pnpm test` does not already pick the package up)
- Modify: `README.md`

- [ ] **Step 1: Confirm CI runs the new tests**

`pnpm test` is `pnpm -r --if-present test`, so a `test` script in `packages/core/package.json` is picked up with no workflow change. Verify rather than assume:

Run: `pnpm test 2>&1 | grep -c "packages/core test"`
Expected: non-zero. If zero, the script name or the `-r` scope is wrong — fix that rather than special-casing the workflow.

- [ ] **Step 2: Document the engine in the README**

Replace the existing single-sentence mention of `packages/core` with:

```markdown
## The progression engine

`packages/core` computes what to lift next. Given a scheme and the user's own
history of an exercise, `nextTarget()` returns the sets, reps and weight for the
next session, plus why it changed — progressed, held, or deloaded — so the UI can
explain a deload rather than silently dropping the weight.

Four schemes: fixed, linear (with deloads on a failure streak), double
progression, and RPE-based autoregulation. Every computed weight is rounded down
to something loadable on the configured plate increment.

It is deliberately pure — no clock, no database, no network, no randomness. The
history array's ordering is the only temporal information it receives. That makes
every rule testable with a literal input and a literal expectation, with no mocks
anywhere, and a test enforces the purity by reading the source.
```

- [ ] **Step 3: Commit**

```bash
git add README.md .github/workflows/ci.yml
git commit -m "Describe the progression engine in the README"
```

---

## What this plan does not do

- **No database tables.** `programs`, `program_days`, `program_exercises`, `workouts`, `workout_entries` and `set_logs` belong to the Programs plan that follows.
- **No API routes and no UI.** Nothing here is reachable from a browser; the payoff is a validated contract for the next plan.
- **No warmup generation.** `is_warmup` exists so a warmup can be recorded and then excluded; generating warmup sets is explicitly out of scope per the design doc.
- **No unit conversion.** Kilograms throughout. Pounds are a display concern for the session player.
