import { describe, expect, it } from "vitest";
import { nextTarget } from "../src/nextTarget.js";
import type { Performance, SchemeBodyweight } from "../src/types.js";

const OPTIONS = { plateIncrementKg: 2.5 };
const scheme = (addedWeightKg: number): SchemeBodyweight => ({
  kind: "bodyweight",
  sets: 3,
  reps: 12,
  addedWeightKg,
});

/** A session that would move any of the weight-based schemes. */
const strong: Performance[] = [
  { sets: [{ reps: 12, weightKg: 0 }], targetWeightKg: 0, targetReps: 12 },
];

describe("bodyweight scheme", () => {
  it("returns the prescription as written, carrying no weight", () => {
    const target = nextTarget(scheme(0), [], OPTIONS);
    expect(target).toEqual({
      needsBaseline: false,
      sets: 3,
      reps: 12,
      addedWeightKg: 0,
      reason: "held",
    });
    // The elliptical bug in one assertion: there is no kilogram field to print.
    expect("weightKg" in target).toBe(false);
  });

  it("never asks for a baseline, since there is no weight to establish", () => {
    expect(nextTarget(scheme(0), [], OPTIONS)).toMatchObject({ needsBaseline: false });
  });

  it("holds regardless of how the last session went", () => {
    // Progression here is by reps, and is deliberately not implemented yet;
    // a hard session must not silently add weight instead.
    expect(nextTarget(scheme(10), strong, OPTIONS)).toMatchObject({
      reason: "held",
      addedWeightKg: 10,
    });
  });

  it("carries a belt as positive weight and a machine's assistance as negative", () => {
    expect(nextTarget(scheme(20), [], OPTIONS)).toMatchObject({ addedWeightKg: 20 });
    expect(nextTarget(scheme(-20), [], OPTIONS)).toMatchObject({ addedWeightKg: -20 });
  });

  /**
   * Rounding a negative number "down" would move it away from zero — turning
   * 21 kg of assistance into 22.5 and making the exercise easier than asked.
   * Both directions must round toward what the gym can actually load, and
   * assistance must round toward zero.
   */
  it("rounds the added weight toward zero, not downward, when it is assistance", () => {
    expect(nextTarget(scheme(21), [], OPTIONS)).toMatchObject({ addedWeightKg: 20 });
    expect(nextTarget(scheme(-21), [], OPTIONS)).toMatchObject({ addedWeightKg: -20 });
  });
});
