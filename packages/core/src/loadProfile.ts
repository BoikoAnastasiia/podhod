import type { SchemeKind } from "./types.js";

/**
 * Which prescriptions make sense for an exercise, derived from the library's
 * own taxonomy rather than stored alongside it.
 *
 * Derived, because it is a fact *about* the equipment, not an extra fact to
 * keep in step with it: a push-up cannot acquire a barbell later. Storing a
 * load type per exercise would mean a column that can disagree with the
 * equipment beside it, and 1,324 rows to keep honest.
 *
 * This is what stops the app printing "4×10 · 20 kg" under an elliptical
 * trainer. 451 of the library's 1,324 exercises carry no external load at all.
 */

/** Equipment that actually loads the movement in kilograms. */
const EXTERNAL_LOAD = new Set([
  "barbell",
  "cable",
  "dumbbell",
  "ez barbell",
  "hammer",
  "kettlebell",
  "leverage machine",
  "medicine ball",
  "olympic barbell",
  "skierg machine",
  "sled machine",
  "smith machine",
  "trap bar",
  "weighted",
]);

/**
 * Machines measured in time, never in reps. "4×10 of an elliptical" is not a
 * prescription anybody has ever written.
 */
const CARDIO_MACHINE = new Set([
  "elliptical machine",
  "stationary bike",
  "stepmill machine",
  "upper body ergometer",
]);

export type LoadProfile = {
  /** Every kind the editor may offer for this exercise. */
  allowed: readonly SchemeKind[];
  /** The one an exercise arrives with when it is added to a program. */
  fallback: SchemeKind;
};

const EXTERNAL: LoadProfile = {
  allowed: ["fixed", "linear", "double", "rpe"],
  fallback: "fixed",
};
/** Holds and planks are body-weight too, so time stays on the menu. */
const BODYWEIGHT: LoadProfile = { allowed: ["bodyweight", "duration"], fallback: "bodyweight" };
const TIMED: LoadProfile = { allowed: ["duration"], fallback: "duration" };
/**
 * Cardio done with your own body — burpees, jump rope, running. Time is the
 * usual prescription, but reps are entirely normal for burpees, so both stay
 * available and time is merely the default.
 */
const CARDIO_BODY: LoadProfile = { allowed: ["duration", "bodyweight"], fallback: "duration" };

/**
 * `equipment` and `bodyPart` are the library's raw taxonomy terms, untranslated
 * — the Russian UI translates them for display only, and this must key off the
 * stored value.
 *
 * Anything unrecognised falls to bodyweight rather than to an external load:
 * offering a kilogram field for a movement we cannot classify invents a number,
 * while offering reps merely omits one.
 */
export function loadProfileOf(equipment: string, bodyPart: string): LoadProfile {
  if (CARDIO_MACHINE.has(equipment)) return TIMED;
  if (bodyPart === "cardio") return CARDIO_BODY;
  if (EXTERNAL_LOAD.has(equipment)) return EXTERNAL;
  return BODYWEIGHT;
}

/** Whether a prescription may be written for this exercise at all. */
export function schemeAllowedFor(kind: SchemeKind, equipment: string, bodyPart: string): boolean {
  return loadProfileOf(equipment, bodyPart).allowed.includes(kind);
}
