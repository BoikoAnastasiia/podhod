import type { LoggedSet } from "./types.js";

/**
 * Epley's estimate: weight × (1 + reps / 30).
 *
 * Used only to rank sets against one another, never presented as a number to
 * attempt. That distinction matters because Epley returns weight × 1.033 for a
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
 * Callers pass working sets only — warmups are excluded upstream, the same rule
 * the progression engine follows.
 */
export function bestE1RM(sets: LoggedSet[]): number {
  // Math.max() of nothing is -Infinity, which would propagate into a stored or
  // rendered value.
  if (sets.length === 0) return 0;
  return Math.max(...sets.map((s) => epley1RM(s.weightKg, s.reps)));
}

/**
 * Strictly greater: repeating your best is not a new record.
 *
 * `priorBest` is the best estimated max over every earlier working set for this
 * user and exercise — one indexed read, thanks to set_logs carrying
 * denormalized user_id and exercise_id. Records are computed this way rather
 * than stored, so there is no table to invalidate when a set is edited or
 * deleted.
 */
export function isPersonalRecord(candidate: LoggedSet, priorBest: number): boolean {
  const estimate = epley1RM(candidate.weightKg, candidate.reps);
  // A set that was not performed is not a record, even against no prior best.
  if (estimate <= 0) return false;
  return estimate > priorBest;
}
