import { describe, expect, it } from "vitest";
import { buildRows } from "../scripts/seed.js";

const SEED = [
  {
    id: "0001",
    name: "3/4 sit-up",
    body_part: "waist",
    equipment: "body weight",
    target: "abs",
    muscle_group: "hip flexors",
    secondary_muscles: ["lower back"],
    media_id: "2gPfomN",
    image: "images/0001-2gPfomN.jpg",
    gif_url: "videos/0001-2gPfomN.gif",
    steps_en: ["Lie down."],
    steps_ru: ["Лягте на спину."],
  },
];

const TAXONOMY = { abs: "пресс", "body weight": "собственный вес" };

describe("buildRows", () => {
  it("produces one exercise row per input", () => {
    const { exercises } = buildRows(SEED, TAXONOMY);
    expect(exercises).toHaveLength(1);
    expect(exercises[0]!.id).toBe("0001");
    expect(exercises[0]!.imagePath).toBe("images/0001-2gPfomN.jpg");
  });

  it("produces an en and a ru translation row per input", () => {
    const { translations } = buildRows(SEED, TAXONOMY);
    expect(translations).toHaveLength(2);
    expect(translations.find((t) => t.lang === "en")!.steps).toEqual(["Lie down."]);
    expect(translations.find((t) => t.lang === "ru")!.steps).toEqual([
      "Лягте на спину.",
    ]);
  });

  it("carries the English name into both locales", () => {
    const { translations } = buildRows(SEED, TAXONOMY);
    expect(translations.find((t) => t.lang === "en")!.name).toBe("3/4 sit-up");
    expect(translations.find((t) => t.lang === "ru")!.name).toBe("3/4 sit-up");
  });

  it("builds English search text from name, target and equipment", () => {
    const { translations } = buildRows(SEED, TAXONOMY);
    expect(translations.find((t) => t.lang === "en")!.searchText).toBe(
      "3/4 sit-up abs body weight",
    );
  });

  it("builds Russian search text from the translated taxonomy", () => {
    const { translations } = buildRows(SEED, TAXONOMY);
    // A Russian speaker can find this by typing "пресс" even though the
    // exercise name itself is English.
    expect(translations.find((t) => t.lang === "ru")!.searchText).toBe(
      "3/4 sit-up пресс собственный вес",
    );
  });

  it("falls back to the English term when the taxonomy lacks an entry", () => {
    const { translations } = buildRows(SEED, {});
    expect(translations.find((t) => t.lang === "ru")!.searchText).toBe(
      "3/4 sit-up abs body weight",
    );
  });
});
