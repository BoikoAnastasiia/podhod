import { describe, expect, it } from "vitest";
import seed from "../exercises.seed.json" with { type: "json" };
import taxonomy from "../taxonomy.ru.json" with { type: "json" };
import type { SeedExercise } from "../src/transform.js";

const terms = new Set<string>();
for (const ex of seed as SeedExercise[]) {
  terms.add(ex.body_part);
  terms.add(ex.equipment);
  terms.add(ex.target);
  terms.add(ex.muscle_group);
  for (const m of ex.secondary_muscles) terms.add(m);
}

describe("taxonomy.ru.json", () => {
  it("covers every taxonomy term present in the seed", () => {
    const dict = taxonomy as Record<string, string>;
    const missing = [...terms].filter((t) => !dict[t]).sort();
    expect(missing).toEqual([]);
  });

  it("has no entries the seed does not use", () => {
    const extra = Object.keys(taxonomy).filter((k) => !terms.has(k)).sort();
    expect(extra).toEqual([]);
  });

  it("has a non-empty Cyrillic translation for every term", () => {
    for (const [en, ru] of Object.entries(taxonomy as Record<string, string>)) {
      // A regex match against \S already implies non-empty, so this alone
      // covers both "translated" and "not blank" in one assertion.
      expect(ru, `"${en}" was not translated`).toMatch(/[Ѐ-ӿ]/);
    }
  });
});
