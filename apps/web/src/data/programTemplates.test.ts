import { schemeSchema } from "@podhod/schema";
import { describe, expect, it } from "vitest";
import dataset from "../../../../data/exercises.seed.json" with { type: "json" };
import { dict } from "../i18n/dict.js";
import { PROGRAM_ICONS, PROGRAM_TEMPLATES } from "./programTemplates.js";

// Test-only import of the 1,324-row dataset — the template module itself must
// stay tiny, which is why templates carry ids, not exercise objects.
const knownIds = new Set((dataset as { id: string }[]).map((e) => e.id));

describe("PROGRAM_TEMPLATES", () => {
  it("references only exercises that exist in the dataset", () => {
    for (const template of PROGRAM_TEMPLATES)
      for (const day of template.days)
        for (const exercise of day.exercises)
          expect(knownIds.has(exercise.exerciseId), `${template.id}: ${exercise.exerciseId}`).toBe(
            true,
          );
  });

  it("carries only schemes the API would accept", () => {
    for (const template of PROGRAM_TEMPLATES)
      for (const day of template.days)
        for (const exercise of day.exercises)
          expect(schemeSchema.safeParse(exercise.scheme).success).toBe(true);
  });

  it("has both languages for every visible string", () => {
    for (const template of PROGRAM_TEMPLATES) {
      for (const localized of [template.name, template.description, ...template.days.map((d) => d.name)]) {
        expect(localized.en.length).toBeGreaterThan(0);
        expect(localized.ru.length).toBeGreaterThan(0);
      }
    }
  });

  it("uses icons from the preset set, so the picker can always mark the current one", () => {
    for (const template of PROGRAM_TEMPLATES) {
      expect(PROGRAM_ICONS).toContain(template.icon);
    }
  });

  it("has a dictionary entry in both languages for every tag", () => {
    for (const template of PROGRAM_TEMPLATES)
      for (const tag of template.tags) {
        const key = `tags.${tag}`;
        expect(dict.en, key).toHaveProperty(key);
        expect(dict.ru, key).toHaveProperty(key);
      }
  });

  it("spans all four scheme kinds across the gallery", () => {
    // The templates double as a showcase of what the engine can drive; losing
    // a kind to an edit would quietly narrow what new users ever see.
    const kinds = new Set(
      PROGRAM_TEMPLATES.flatMap((t) => t.days.flatMap((d) => d.exercises.map((e) => e.scheme.kind))),
    );
    expect([...kinds].sort()).toEqual(["double", "fixed", "linear", "rpe"]);
  });
});
