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
 * session — the band is asymmetric because overshooting effort is more costly
 * than undershooting it.
 *
 * RPE is optional on a logged set, and a session that recorded none holds.
 * Reading absent effort data as "that was easy" and adding weight is the one
 * clearly wrong answer available here.
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
  const prescribe = (weightKg: number, reason: "progressed" | "held" | "deloaded"): Target => ({
    needsBaseline: false,
    sets: scheme.sets,
    reps: scheme.reps,
    weightKg,
    delta: weightKg - base,
    reason,
  });

  const rpes = last.sets
    .map((s) => s.rpe)
    .filter((rpe): rpe is number => typeof rpe === "number");

  if (rpes.length === 0) return prescribe(round(base), "held");

  const mean = rpes.reduce((sum, rpe) => sum + rpe, 0) / rpes.length;

  if (mean < scheme.targetRpe - LOWER_TOLERANCE) {
    return prescribe(round(base * (1 + scheme.adjustPct)), "progressed");
  }
  if (mean > scheme.targetRpe + UPPER_TOLERANCE) {
    return prescribe(round(base * (1 - scheme.adjustPct)), "deloaded");
  }
  return prescribe(round(base), "held");
}
