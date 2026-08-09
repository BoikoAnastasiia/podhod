import { describe, expect, it } from "vitest";
import dataset from "../../../../data/exercises.seed.json" with { type: "json" };
import { POPULAR_EXERCISE_IDS } from "./popularExercises.js";

const knownIds = new Set((dataset as { id: string }[]).map((e) => e.id));

describe("POPULAR_EXERCISE_IDS", () => {
  it("references only exercises that exist in the dataset", () => {
    // A re-seed that drops one of these would otherwise ship a landing page
    // with a silently missing card.
    for (const id of POPULAR_EXERCISE_IDS) {
      expect(knownIds.has(id), id).toBe(true);
    }
  });

  it("has no duplicates", () => {
    expect(new Set(POPULAR_EXERCISE_IDS).size).toBe(POPULAR_EXERCISE_IDS.length);
  });
});
