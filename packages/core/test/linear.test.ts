import { describe, expect, it } from "vitest";
import { nextTarget } from "../src/nextTarget.js";
import type { Performance, SchemeLinear } from "../src/types.js";

const scheme: SchemeLinear = {
  kind: "linear",
  sets: 3,
  reps: 5,
  incrementKg: 2.5,
  failuresBeforeDeload: 3,
  deloadPct: 0.1,
};
const opts = { plateIncrementKg: 2.5 };

/** A session where every set hit the target. */
const hit = (weightKg: number, reps = 5, sets = 3): Performance => ({
  sets: Array.from({ length: sets }, () => ({ reps, weightKg })),
  targetWeightKg: weightKg,
  targetReps: 5,
});

/** A session at `weightKg` where the last set fell short. */
const missed = (weightKg: number, shortReps = 3): Performance => ({
  sets: [
    { reps: 5, weightKg },
    { reps: 5, weightKg },
    { reps: shortReps, weightKg },
  ],
  targetWeightKg: weightKg,
  targetReps: 5,
});

describe("linear scheme", () => {
  it("asks for a baseline when there is no history, rather than guessing a weight", () => {
    expect(nextTarget(scheme, [], opts)).toEqual({ needsBaseline: true });
  });

  it("adds the increment when every set hit the target", () => {
    expect(nextTarget(scheme, [hit(100)], opts)).toEqual({
      needsBaseline: false,
      sets: 3,
      reps: 5,
      weightKg: 102.5,
      delta: 2.5,
      reason: "progressed",
    });
  });

  it("holds the weight after a single miss", () => {
    expect(nextTarget(scheme, [missed(100)], opts)).toMatchObject({
      weightKg: 100,
      delta: 0,
      reason: "held",
    });
  });

  it("still holds at one short of the deload threshold", () => {
    expect(nextTarget(scheme, [missed(100), missed(100)], opts)).toMatchObject({
      weightKg: 100,
      reason: "held",
    });
  });

  it("deloads on the third consecutive miss", () => {
    const history = [missed(100), missed(100), missed(100)];
    // 100 × 0.9 = 90, already a multiple of 2.5.
    expect(nextTarget(scheme, history, opts)).toMatchObject({
      weightKg: 90,
      delta: -10,
      reason: "deloaded",
    });
  });

  it("rounds a deload down to a loadable weight", () => {
    const history = [missed(102.5), missed(102.5), missed(102.5)];
    // 102.5 × 0.9 = 92.25 → down to 90 on 2.5 kg plates.
    expect(nextTarget(scheme, history, opts)).toMatchObject({
      weightKg: 90,
      reason: "deloaded",
    });
  });

  /**
   * The case that makes this more than a counter. History still contains the
   * three misses that CAUSED the deload; counting them again would deload every
   * session afterwards, walking the weight toward zero.
   */
  it("does not re-count the misses that caused a previous deload", () => {
    const history = [
      missed(90), // first miss at the post-deload weight
      hit(90), // the deload session itself: target dropped 100 → 90
      missed(100),
      missed(100),
      missed(100),
    ];
    expect(nextTarget(scheme, history, opts)).toMatchObject({
      weightKg: 90,
      reason: "held",
    });
  });

  /**
   * The harder version of the same case, and the one that actually exercises the
   * streak reset: the deload session was ALSO missed, so nothing succeeded
   * anywhere in this history. A plain consecutive-failure count sees four misses
   * and deloads again immediately. Only the weight drop between the deload
   * session and the one before it stops the count.
   */
  it("stops counting at the deload even when the deload session was itself missed", () => {
    const history = [
      missed(90), // post-deload, missed again — a streak of one, not four
      missed(100),
      missed(100),
      missed(100),
    ];
    expect(nextTarget(scheme, history, opts)).toMatchObject({
      weightKg: 90,
      reason: "held",
    });
  });

  it("counts a session with fewer working sets than prescribed as a miss", () => {
    const short: Performance = {
      sets: [
        { reps: 5, weightKg: 100 },
        { reps: 5, weightKg: 100 },
      ],
      targetWeightKg: 100,
      targetReps: 5,
    };
    expect(nextTarget(scheme, [short], opts)).toMatchObject({ reason: "held" });
  });

  it("counts a session lifted below the target weight as a miss, even at full reps", () => {
    const light: Performance = {
      sets: Array.from({ length: 3 }, () => ({ reps: 5, weightKg: 95 })),
      targetWeightKg: 100,
      targetReps: 5,
    };
    expect(nextTarget(scheme, [light], opts)).toMatchObject({ reason: "held" });
  });

  it("treats extra reps as a hit, not a failure", () => {
    expect(nextTarget(scheme, [hit(100, 7)], opts)).toMatchObject({
      reason: "progressed",
    });
  });

  it("treats a logged session with no working sets as a miss rather than crashing", () => {
    const empty: Performance = { sets: [], targetWeightKg: 100, targetReps: 5 };
    expect(nextTarget(scheme, [empty], opts)).toMatchObject({ reason: "held" });
  });
});
