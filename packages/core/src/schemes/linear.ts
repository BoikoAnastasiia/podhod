import { roundToIncrement } from "../rounding.js";
import type { NextTargetOptions, Performance, SchemeLinear, Target } from "../types.js";

/**
 * A session counts as a hit only if the prescribed number of working sets were
 * all performed at or above the target weight and target reps. Doing more is a
 * hit; doing fewer sets, a lighter bar, or fewer reps is not.
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
 * History is most-recent-first and still contains the failures that caused any
 * earlier deload. Counting those again would deload on every subsequent session
 * and walk the weight toward zero. There is no stored "a deload happened here"
 * flag to consult, and there does not need to be: a deload is visible as a
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
  const prescribe = (weightKg: number, reason: "progressed" | "held" | "deloaded"): Target => ({
    needsBaseline: false,
    sets: scheme.sets,
    reps: scheme.reps,
    weightKg,
    delta: weightKg - base,
    reason,
  });

  if (sessionSucceeded(last, scheme.sets)) {
    return prescribe(round(base + scheme.incrementKg), "progressed");
  }

  if (failureStreak(history, scheme.sets) >= scheme.failuresBeforeDeload) {
    return prescribe(round(base * (1 - scheme.deloadPct)), "deloaded");
  }

  return prescribe(round(base), "held");
}
