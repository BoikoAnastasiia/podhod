import { describe, expect, it } from "vitest";
import { loadProfileOf, schemeAllowedFor } from "../src/loadProfile.js";

/**
 * The classification that decides whether an exercise may be prescribed in
 * kilograms at all. The cases below are taken from the real library, because
 * the bug this prevents was a real row: "walk elliptical cross trainer,
 * 4×10 · 20 kg".
 */
describe("loadProfileOf", () => {
  it("gives cardio machines time and nothing else", () => {
    expect(loadProfileOf("elliptical machine", "cardio")).toEqual({
      allowed: ["duration"],
      fallback: "duration",
    });
    // Reps must not even be offered — that is the reading that started this.
    expect(schemeAllowedFor("fixed", "elliptical machine", "cardio")).toBe(false);
    expect(schemeAllowedFor("bodyweight", "stationary bike", "cardio")).toBe(false);
  });

  it("defaults body-powered cardio to time but still allows reps", () => {
    // A burpee is cardio and is genuinely prescribed both ways.
    const burpee = loadProfileOf("body weight", "cardio");
    expect(burpee.fallback).toBe("duration");
    expect(burpee.allowed).toContain("bodyweight");
    expect(schemeAllowedFor("linear", "body weight", "cardio")).toBe(false);
  });

  it("keeps the weight schemes for anything actually loaded in kilograms", () => {
    for (const equipment of ["barbell", "dumbbell", "cable", "smith machine", "kettlebell"]) {
      expect(loadProfileOf(equipment, "chest").fallback).toBe("fixed");
      expect(schemeAllowedFor("linear", equipment, "chest")).toBe(true);
    }
  });

  it("treats body weight, bands and assisted machines as bodyweight", () => {
    for (const equipment of ["body weight", "band", "resistance band", "assisted"]) {
      const profile = loadProfileOf(equipment, "upper arms");
      expect(profile.fallback).toBe("bodyweight");
      // A hold is a legitimate prescription for these, so time stays offered.
      expect(profile.allowed).toContain("duration");
      expect(schemeAllowedFor("fixed", equipment, "upper arms")).toBe(false);
    }
  });

  /**
   * A term nobody has classified must not invent a weight. Reps merely omit a
   * number; kilograms would state one that does not exist.
   */
  it("falls back to bodyweight for equipment it does not recognise", () => {
    expect(loadProfileOf("hydraulic sled thing", "chest").fallback).toBe("bodyweight");
    expect(schemeAllowedFor("fixed", "hydraulic sled thing", "chest")).toBe(false);
  });
});
