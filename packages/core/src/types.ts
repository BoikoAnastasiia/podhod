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

/**
 * Your own body as the load. `addedWeightKg` is *signed*, which is the whole
 * point of the field: +20 is a dipping belt, −20 is an assisted machine taking
 * twenty kilos off you, 0 is a plain push-up. One number covers three cases
 * that would otherwise be three kinds, and it fixes assistance being recorded
 * as though it were resistance — on an assisted machine, progress is the number
 * climbing towards zero.
 */
export type SchemeBodyweight = {
  kind: "bodyweight";
  sets: number;
  reps: number;
  addedWeightKg: number;
};

/** Prescribed in time: cardio machines, and holds like a plank. */
export type SchemeDuration = {
  kind: "duration";
  sets: number;
  seconds: number;
};

export type Scheme =
  | SchemeFixed
  | SchemeLinear
  | SchemeDouble
  | SchemeRpe
  | SchemeBodyweight
  | SchemeDuration;

export type SchemeKind = Scheme["kind"];

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
 *
 * The three prescriptions differ by the fields they carry, and are narrowed with
 * `in` rather than by a tag: `"seconds" in target` says exactly what a
 * `target.unit === "seconds"` would, without a second field that can contradict
 * the first about which values are present.
 *
 * The kilogram variant is unchanged from when it was the only one — the two
 * additions sit beside it rather than reshaping it, so every rule already
 * asserted about weight progression still means what it meant.
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
    }
  | {
      needsBaseline: false;
      sets: number;
      reps: number;
      /** Signed: negative is assistance. See SchemeBodyweight. */
      addedWeightKg: number;
      /**
       * Always "held": a bodyweight prescription is what the sheet says and
       * nothing computes a next one (the owner's call, 2026-08-12). Progression
       * by reps can be added later without moving this shape.
       */
      reason: "held";
    }
  | { needsBaseline: false; sets: number; seconds: number; reason: "held" };

export type NextTargetOptions = { plateIncrementKg: number };
