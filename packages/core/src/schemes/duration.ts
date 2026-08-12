import type { Performance, SchemeDuration, Target } from "../types.js";

/**
 * Time on the clock: cardio machines, and holds like a plank.
 *
 * No history, no rounding, no plate increment — seconds are seconds. It carries
 * no reps at all, which is the point: "4×10" under an elliptical trainer was
 * the reading that started this, and a prescription that cannot express reps
 * cannot print them.
 */
export function durationTarget(
  scheme: SchemeDuration,
  _history: Performance[],
): Target {
  return {
    needsBaseline: false,
    sets: scheme.sets,
    seconds: scheme.seconds,
    reason: "held",
  };
}
