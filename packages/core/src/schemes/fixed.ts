import { roundToIncrement } from "../rounding.js";
import type { NextTargetOptions, Performance, SchemeFixed, Target } from "../types.js";

/**
 * The only scheme that derives nothing from history, and therefore the only one
 * that never asks for a baseline: its weight is configured, not established.
 *
 * It still reports a delta, because the configured weight can be edited between
 * sessions and a silent change is worse than a visible one.
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
