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
