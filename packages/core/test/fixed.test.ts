import { describe, expect, it } from "vitest";
import { nextTarget } from "../src/nextTarget.js";
import type { Performance, SchemeFixed } from "../src/types.js";

const scheme: SchemeFixed = { kind: "fixed", sets: 3, reps: 10, weightKg: 60 };
const opts = { plateIncrementKg: 2.5 };

const session = (weightKg: number, reps: number, count = 3): Performance => ({
  sets: Array.from({ length: count }, () => ({ reps, weightKg })),
  targetWeightKg: weightKg,
  targetReps: reps,
});

describe("fixed scheme", () => {
  it("prescribes the configured weight with no history, rather than asking for a baseline", () => {
    // The distinction from every other scheme: nothing here is derived from a
    // previous session, so there is nothing to establish.
    expect(nextTarget(scheme, [], opts)).toEqual({
      needsBaseline: false,
      sets: 3,
      reps: 10,
      weightKg: 60,
      delta: 0,
      reason: "held",
    });
  });

  it("keeps prescribing the same thing regardless of how the last session went", () => {
    expect(nextTarget(scheme, [session(60, 4)], opts)).toMatchObject({
      weightKg: 60,
      reps: 10,
      reason: "held",
    });
  });

  it("reports the delta against the last session's target, so an edited scheme is visible", () => {
    // The user raised the configured weight from 55 to 60 between sessions; the
    // chip should say +5, not 0.
    expect(nextTarget(scheme, [session(55, 10)], opts)).toMatchObject({
      weightKg: 60,
      delta: 5,
    });
  });

  it("rounds an unloadable configured weight down", () => {
    const odd: SchemeFixed = { ...scheme, weightKg: 82.4 };
    expect(nextTarget(odd, [], opts)).toMatchObject({ weightKg: 80 });
  });
});
