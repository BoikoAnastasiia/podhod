import { describe, expect, it } from "vitest";
import { transformExercise, type RawExercise } from "../src/transform.js";

const RAW = {
  id: "0001",
  name: "3/4 sit-up",
  category: "waist",
  body_part: "waist",
  equipment: "body weight",
  muscle_group: "hip flexors",
  secondary_muscles: ["hip flexors", "lower back"],
  target: "abs",
  image: "images/0001-2gPfomN.jpg",
  gif_url: "videos/0001-2gPfomN.gif",
  media_id: "2gPfomN",
  created_at: "2026-03-18T12:31:32.854798+00:00",
  attribution: "© Gym visual — https://gymvisual.com/",
  instructions: { en: "...", ru: "...", es: "...", fr: "..." },
  instruction_steps: {
    en: ["Lie down on the floor.", "Place your hands behind your head."],
    ru: ["Лягте на спину.", "Положите руки за голову."],
    es: ["..."],
    fr: ["..."],
  },
};

describe("transformExercise", () => {
  it("keeps only en and ru steps", () => {
    const out = transformExercise(RAW as RawExercise);
    expect(out.steps_en).toEqual(RAW.instruction_steps.en);
    expect(out.steps_ru).toEqual(RAW.instruction_steps.ru);
    expect(out).not.toHaveProperty("instruction_steps");
    expect(out).not.toHaveProperty("instructions");
  });

  it("drops attribution, created_at and the duplicate category field", () => {
    const out = transformExercise(RAW as RawExercise);
    expect(out).not.toHaveProperty("attribution");
    expect(out).not.toHaveProperty("created_at");
    expect(out).not.toHaveProperty("category");
  });

  it("carries identity, taxonomy and media fields through unchanged", () => {
    const out = transformExercise(RAW as RawExercise);
    expect(out.id).toBe("0001");
    expect(out.name).toBe("3/4 sit-up");
    expect(out.body_part).toBe("waist");
    expect(out.equipment).toBe("body weight");
    expect(out.target).toBe("abs");
    expect(out.muscle_group).toBe("hip flexors");
    expect(out.secondary_muscles).toEqual(["hip flexors", "lower back"]);
    expect(out.media_id).toBe("2gPfomN");
    expect(out.image).toBe("images/0001-2gPfomN.jpg");
    expect(out.gif_url).toBe("videos/0001-2gPfomN.gif");
  });
});
