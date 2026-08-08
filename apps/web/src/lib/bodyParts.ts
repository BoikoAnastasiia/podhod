/**
 * The dataset's ten bodyPart values, in display order. One shared list: the
 * library grid and the exercise picker filter by the same taxonomy, and a
 * value typo'd in one place but not the other would silently match nothing.
 * Russian labels come from taxonomy.ru.json via `term()`.
 */
export const BODY_PARTS: string[] = [
  "back",
  "cardio",
  "chest",
  "lower arms",
  "lower legs",
  "neck",
  "shoulders",
  "upper arms",
  "upper legs",
  "waist",
];
