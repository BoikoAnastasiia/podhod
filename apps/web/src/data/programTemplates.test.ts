import { schemeAllowedFor } from "@podhod/core";
import { PROGRAM_ICON_COLOR_PRESETS, PROGRAM_ICON_NAMES, schemeSchema } from "@podhod/schema";
import { describe, expect, it } from "vitest";
import dataset from "../../../../data/exercises.seed.json" with { type: "json" };
import { dict } from "../i18n/dict.js";
import { PROGRAM_TEMPLATES } from "./programTemplates.js";

// Test-only import of the 1,324-row dataset — the template module itself must
// stay tiny, which is why templates carry ids, not exercise objects.
const knownIds = new Set((dataset as { id: string }[]).map((e) => e.id));
const taxonomy = new Map(
  (dataset as { id: string; body_part: string; equipment: string }[]).map((e) => [
    e.id,
    { bodyPart: e.body_part, equipment: e.equipment },
  ]),
);

describe("PROGRAM_TEMPLATES", () => {
  it("references only exercises that exist in the dataset", () => {
    for (const template of PROGRAM_TEMPLATES)
      for (const exercise of template.exercises)
        expect(knownIds.has(exercise.exerciseId), `${template.id}: ${exercise.exerciseId}`).toBe(
          true,
        );
  });

  it("carries only schemes the API would accept", () => {
    for (const template of PROGRAM_TEMPLATES)
      for (const exercise of template.exercises)
        expect(schemeSchema.safeParse(exercise.scheme).success).toBe(true);
  });

  /**
   * Valid is not the same as suitable. The API refuses a prescription written
   * in kilograms for a movement that carries no external load, so a template
   * pairing one with the other would fail at the moment somebody took it —
   * after several exercises had already been created.
   */
  it("prescribes each exercise in a unit that exercise can actually take", () => {
    for (const template of PROGRAM_TEMPLATES)
      for (const exercise of template.exercises) {
        const terms = taxonomy.get(exercise.exerciseId);
        expect(terms, `${template.id}: ${exercise.exerciseId}`).toBeDefined();
        expect(
          schemeAllowedFor(exercise.scheme.kind, terms!.equipment, terms!.bodyPart),
          `${template.id}: ${exercise.exerciseId} is ${terms!.equipment}, prescribed as ${exercise.scheme.kind}`,
        ).toBe(true);
      }
  });

  it("has both languages for every visible string", () => {
    for (const template of PROGRAM_TEMPLATES) {
      for (const localized of [template.name, template.description]) {
        expect(localized.en.length).toBeGreaterThan(0);
        expect(localized.ru.length).toBeGreaterThan(0);
      }
    }
  });

  it("uses icons and colours the picker offers, so it can mark the current one", () => {
    for (const template of PROGRAM_TEMPLATES) {
      expect(PROGRAM_ICON_NAMES).toContain(template.icon);
      expect(PROGRAM_ICON_COLOR_PRESETS).toContain(template.iconColor);
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
      PROGRAM_TEMPLATES.flatMap((t) => t.exercises.map((e) => e.scheme.kind)),
    );
    expect([...kinds].sort()).toEqual(["double", "fixed", "linear", "rpe"]);
  });
});
