import { describe, expect, it } from "vitest";
import { roundToIncrement } from "../src/rounding.js";

describe("roundToIncrement", () => {
  it.each([
    [82.4, 2.5, 80],
    [82.5, 2.5, 82.5],
    [82.6, 2.5, 82.5],
    [100, 2.5, 100],
    [72, 2.5, 70],
    [61.25, 1.25, 61.25],
    [5, 5, 5],
    [4.9, 5, 0],
  ])("rounds %s kg down to a multiple of %s → %s", (kg, inc, expected) => {
    expect(roundToIncrement(kg, inc, "down")).toBe(expected);
  });

  /**
   * The whole reason this function exists rather than a bare Math.floor: in
   * IEEE-754, quotients that are mathematically whole are routinely 13.9999...
   * or 33.0000...4, and flooring those silently drops a plate. Every value here
   * is one a naive implementation gets wrong.
   */
  it.each([
    [7.5, 2.5, 7.5],
    [0.3, 0.1, 0.3],
    [16.8, 1.2, 16.8],
    [2.4, 0.8, 2.4],
  ])("does not lose an increment to float error: %s / %s", (kg, inc, expected) => {
    expect(roundToIncrement(kg, inc, "down")).toBe(expected);
  });

  it("rounds to nearest when asked", () => {
    expect(roundToIncrement(82.4, 2.5, "nearest")).toBe(82.5);
    expect(roundToIncrement(81, 2.5, "nearest")).toBe(80);
  });

  it("defaults to rounding down, because a target must be loadable", () => {
    expect(roundToIncrement(82.4, 2.5)).toBe(80);
  });

  it("never returns a negative weight", () => {
    expect(roundToIncrement(-5, 2.5, "down")).toBe(0);
  });

  it("returns a clean decimal rather than float noise", () => {
    // 3 × 0.1 is 0.30000000000000004, and that value would be rendered.
    expect(String(roundToIncrement(0.35, 0.1, "down"))).toBe("0.3");
  });

  it.each([0, -1, Number.NaN])("rejects a %s increment rather than dividing by it", (inc) => {
    expect(() => roundToIncrement(100, inc)).toThrow(RangeError);
  });
});
