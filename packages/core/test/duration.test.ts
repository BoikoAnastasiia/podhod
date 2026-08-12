import { describe, expect, it } from "vitest";
import { nextTarget } from "../src/nextTarget.js";
import type { Performance, SchemeDuration } from "../src/types.js";

const OPTIONS = { plateIncrementKg: 2.5 };
const scheme: SchemeDuration = { kind: "duration", sets: 1, seconds: 1200 };

describe("duration scheme", () => {
  it("returns sets and seconds, with neither reps nor weight", () => {
    const target = nextTarget(scheme, [], OPTIONS);
    expect(target).toEqual({ needsBaseline: false, sets: 1, seconds: 1200, reason: "held" });
    /*
     * The whole reason this kind exists. An elliptical prescription that cannot
     * express reps or kilograms cannot print "4×10 · 20 kg" under one.
     */
    expect("reps" in target).toBe(false);
    expect("weightKg" in target).toBe(false);
  });

  it("ignores history and the plate increment entirely", () => {
    const history: Performance[] = [
      { sets: [{ reps: 1, weightKg: 0 }], targetWeightKg: 0, targetReps: 1 },
    ];
    expect(nextTarget(scheme, history, { plateIncrementKg: 1.25 })).toEqual(
      nextTarget(scheme, [], OPTIONS),
    );
  });

  it("holds a plank the same way it holds a treadmill", () => {
    const plank: SchemeDuration = { kind: "duration", sets: 3, seconds: 45 };
    expect(nextTarget(plank, [], OPTIONS)).toMatchObject({ sets: 3, seconds: 45, reason: "held" });
  });
});
