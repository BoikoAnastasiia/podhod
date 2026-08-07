import { describe, expect, it } from "vitest";
import { nextTarget } from "../src/nextTarget.js";
import type { Performance, SchemeRpe } from "../src/types.js";

const scheme: SchemeRpe = {
  kind: "rpe",
  sets: 3,
  reps: 5,
  targetRpe: 8,
  adjustPct: 0.05,
};
const opts = { plateIncrementKg: 2.5 };

const session = (weightKg: number, rpes: (number | undefined)[]): Performance => ({
  sets: rpes.map((rpe) => ({ reps: 5, weightKg, rpe })),
  targetWeightKg: weightKg,
  targetReps: 5,
});

describe("rpe scheme", () => {
  it("asks for a baseline when there is no history", () => {
    expect(nextTarget(scheme, [], opts)).toEqual({ needsBaseline: true });
  });

  it("adds weight when the session was comfortably below the target effort", () => {
    // mean 6.5, target 8 → below 8 − 1, so it was too easy. 100 × 1.05 = 105.
    expect(nextTarget(scheme, [session(100, [6, 6.5, 7])], opts)).toMatchObject({
      weightKg: 105,
      delta: 5,
      reason: "progressed",
    });
  });

  it("reduces weight when the session was above the target effort", () => {
    // mean 9, target 8 → above 8 + 0.5. 100 × 0.95 = 95.
    expect(nextTarget(scheme, [session(100, [8.5, 9, 9.5])], opts)).toMatchObject({
      weightKg: 95,
      delta: -5,
      reason: "deloaded",
    });
  });

  it("holds inside the dead band around the target", () => {
    expect(nextTarget(scheme, [session(100, [7.5, 8, 8.5])], opts)).toMatchObject({
      weightKg: 100,
      delta: 0,
      reason: "held",
    });
  });

  it("holds at the exact lower edge rather than progressing on it", () => {
    // mean exactly 7 = targetRpe − 1. The rule is "below", not "at or below".
    expect(nextTarget(scheme, [session(100, [7, 7, 7])], opts)).toMatchObject({
      reason: "held",
    });
  });

  it("holds at the exact upper edge rather than deloading on it", () => {
    // mean exactly 8.5 = targetRpe + 0.5.
    expect(nextTarget(scheme, [session(100, [8.5, 8.5, 8.5])], opts)).toMatchObject({
      reason: "held",
    });
  });

  /**
   * RPE is optional per set. A session with none recorded carries no information
   * about effort, and the safe reading of no information is not "that was easy".
   */
  it("holds when no set carried an RPE, rather than reading silence as easy", () => {
    expect(
      nextTarget(scheme, [session(100, [undefined, undefined, undefined])], opts),
    ).toMatchObject({ weightKg: 100, reason: "held" });
  });

  it("averages only the sets that recorded an RPE", () => {
    // Recorded: 6 and 6. Mean 6, well below 7 → progress.
    expect(nextTarget(scheme, [session(100, [6, undefined, 6])], opts)).toMatchObject({
      reason: "progressed",
    });
  });

  it("rounds an adjusted weight down to something loadable", () => {
    // 102.5 × 1.05 = 107.625 → 107.5 on 2.5 kg plates.
    expect(nextTarget(scheme, [session(102.5, [6, 6, 6])], opts)).toMatchObject({
      weightKg: 107.5,
    });
  });

  it("treats a logged session with no working sets as a hold", () => {
    const empty: Performance = { sets: [], targetWeightKg: 100, targetReps: 5 };
    expect(nextTarget(scheme, [empty], opts)).toMatchObject({ reason: "held" });
  });

  it("reports a delta of zero when holding, not a rounding artefact", () => {
    // A held weight is re-rounded, and 97.5 is already loadable, so the delta
    // must be exactly 0 rather than a float remainder.
    expect(nextTarget(scheme, [session(97.5, [8, 8, 8])], opts)).toMatchObject({
      weightKg: 97.5,
      delta: 0,
    });
  });
});
