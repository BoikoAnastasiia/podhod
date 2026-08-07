import { describe, expect, it } from "vitest";
import { bestE1RM, epley1RM, isPersonalRecord } from "../src/oneRepMax.js";

describe("epley1RM", () => {
  it("estimates a one-rep max from a multi-rep set", () => {
    // 100 × (1 + 5/30) = 116.666…
    expect(epley1RM(100, 5)).toBeCloseTo(116.667, 3);
  });

  it("ranks a heavier set above a lighter one at equal reps", () => {
    expect(epley1RM(105, 5)).toBeGreaterThan(epley1RM(100, 5));
  });

  it("ranks more reps above fewer at equal weight", () => {
    expect(epley1RM(100, 8)).toBeGreaterThan(epley1RM(100, 5));
  });

  it.each([
    [100, 0],
    [0, 5],
    [-10, 5],
    [100, -1],
  ])("returns zero for a set that was not performed: %s kg × %s", (kg, reps) => {
    expect(epley1RM(kg, reps)).toBe(0);
  });
});

describe("bestE1RM", () => {
  it("takes the best set, which is not always the heaviest", () => {
    // 100×5 → 116.7 beats 105×3 → 115.5, despite the lighter bar. This is the
    // entire reason for estimating rather than comparing bar weights.
    expect(
      bestE1RM([
        { weightKg: 105, reps: 3 },
        { weightKg: 100, reps: 5 },
      ]),
    ).toBeCloseTo(116.667, 3);
  });

  it("returns zero for an empty set list rather than -Infinity", () => {
    // Math.max() with no arguments is -Infinity, which would then be stored or
    // rendered.
    expect(bestE1RM([])).toBe(0);
  });
});

describe("isPersonalRecord", () => {
  it("is a record when it beats everything before it", () => {
    expect(isPersonalRecord({ weightKg: 100, reps: 5 }, 110)).toBe(true);
  });

  it("is not a record when it merely equals the prior best", () => {
    // Repeating your best is not a new record.
    expect(isPersonalRecord({ weightKg: 100, reps: 5 }, epley1RM(100, 5))).toBe(false);
  });

  it("is a record when there is no prior best at all", () => {
    expect(isPersonalRecord({ weightKg: 60, reps: 1 }, 0)).toBe(true);
  });

  it("is not a record for a set that was not performed, even with no prior best", () => {
    expect(isPersonalRecord({ weightKg: 60, reps: 0 }, 0)).toBe(false);
  });
});
