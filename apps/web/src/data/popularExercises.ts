/**
 * The landing's "most popular" row — curated, since the app tracks no usage
 * yet. The list mirrors what every most-logged-exercises survey converges
 * on: bench, squat, deadlift, a vertical pull, an overhead press, curls,
 * leg press, RDL. Ids reference data/exercises.seed.json and are pinned by
 * popularExercises.test.ts. When the session player exists, real logging
 * data can replace this file.
 */
export const POPULAR_EXERCISE_IDS = [
  "0025", // barbell bench press
  "0043", // barbell full squat
  "0032", // barbell deadlift
  "0198", // cable pulldown
  "0091", // barbell seated overhead press
  "0294", // dumbbell biceps curl
  "0739", // sled 45° leg press
  "0085", // barbell romanian deadlift
] as const;
