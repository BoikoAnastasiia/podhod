import { describe, expect, it } from "vitest";
import { nextTarget } from "../src/nextTarget.js";
import type { Performance, SchemeDouble } from "../src/types.js";

const scheme: SchemeDouble = {
  kind: "double",
  sets: 3,
  repLow: 8,
  repHigh: 12,
  incrementKg: 2.5,
};
const opts = { plateIncrementKg: 2.5 };

const session = (weightKg: number, reps: number[]): Performance => ({
  sets: reps.map((r) => ({ reps: r, weightKg })),
  targetWeightKg: weightKg,
  targetReps: reps[0] ?? 0,
});

describe("double progression", () => {
  it("asks for a baseline when there is no history", () => {
    expect(nextTarget(scheme, [], opts)).toEqual({ needsBaseline: true });
  });

  it("adds weight and drops back to the bottom of the range once every set reaches the top", () => {
    expect(nextTarget(scheme, [session(50, [12, 12, 12])], opts)).toEqual({
      needsBaseline: false,
      sets: 3,
      reps: 8,
      weightKg: 52.5,
      delta: 2.5,
      reason: "progressed",
    });
  });

  /**
   * The rule that makes double progression work: you chase the WEAKEST set, not
   * the average and not the best. Targeting one more than the lowest is what
   * drags the whole range upward; targeting the best set would let the weakest
   * lag indefinitely.
   */
  it("holds the weight and chases the weakest set by one rep", () => {
    expect(nextTarget(scheme, [session(50, [12, 10, 9])], opts)).toMatchObject({
      weightKg: 50,
      reps: 10,
      delta: 0,
      reason: "held",
    });
  });

  it("caps the chased rep target at the top of the range", () => {
    // Weakest set was 11; +1 is 12, which is repHigh and therefore allowed.
    expect(nextTarget(scheme, [session(50, [12, 12, 11])], opts)).toMatchObject({
      weightKg: 50,
      reps: 12,
      reason: "held",
    });
  });

  it("counts fewer sets than prescribed as not having reached the top", () => {
    expect(nextTarget(scheme, [session(50, [12, 12])], opts)).toMatchObject({
      weightKg: 50,
      reason: "held",
    });
  });

  it("never targets below the bottom of the range, however bad the session was", () => {
    expect(nextTarget(scheme, [session(50, [8, 6, 5])], opts)).toMatchObject({
      weightKg: 50,
      reps: 8,
    });
  });

  it("treats a logged session with no working sets as a hold at the bottom of the range", () => {
    const empty: Performance = { sets: [], targetWeightKg: 50, targetReps: 8 };
    expect(nextTarget(scheme, [empty], opts)).toMatchObject({
      weightKg: 50,
      reps: 8,
      reason: "held",
    });
  });

  it("progresses on reps beyond the top of the range, not just exactly at it", () => {
    expect(nextTarget(scheme, [session(50, [14, 13, 12])], opts)).toMatchObject({
      reps: 8,
      weightKg: 52.5,
      reason: "progressed",
    });
  });
});
