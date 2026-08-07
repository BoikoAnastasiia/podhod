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
  // what drags the range upward. A session with nothing logged has no weakest
  // set, so it restarts at the bottom of the range.
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
