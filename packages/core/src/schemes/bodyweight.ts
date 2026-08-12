import { roundToIncrement } from "../rounding.js";
import type { NextTargetOptions, Performance, SchemeBodyweight, Target } from "../types.js";

/**
 * Your own body, plus or minus whatever the equipment adds or removes.
 *
 * It reads no history at all — a bodyweight prescription is what the sheet says
 * (the owner's call, 2026-08-12), so there is nothing to compute and nothing to
 * establish; `needsBaseline` never applies. Progression here is by reps rather
 * than by kilograms, and the day it is added it changes this function only.
 *
 * The added weight is still rounded to the plate increment, because when it is
 * non-zero it is real plate: a dipping belt and an assisted machine both load in
 * whatever the gym stocks. Rounding runs on the magnitude and the sign goes back
 * on afterwards, so assistance of −21 kg becomes −20 rather than −22.5 —
 * rounding a negative number "down" would quietly make the exercise *easier*
 * than prescribed.
 */
export function bodyweightTarget(
  scheme: SchemeBodyweight,
  _history: Performance[],
  { plateIncrementKg }: NextTargetOptions,
): Target {
  const magnitude = roundToIncrement(Math.abs(scheme.addedWeightKg), plateIncrementKg, "down");
  return {
    needsBaseline: false,
    sets: scheme.sets,
    reps: scheme.reps,
    addedWeightKg: scheme.addedWeightKg < 0 ? -magnitude : magnitude,
    reason: "held",
  };
}
