import { index, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Language-neutral fields only. `attribution` is deliberately absent — every
 * upstream row carries the identical string, so it lives as a constant in
 * packages/core rather than 1,324 times in the database.
 */
export const exercises = sqliteTable(
  "exercises",
  {
    id: text("id").primaryKey(),
    bodyPart: text("body_part").notNull(),
    equipment: text("equipment").notNull(),
    target: text("target").notNull(),
    muscleGroup: text("muscle_group").notNull(),
    secondaryMuscles: text("secondary_muscles", { mode: "json" })
      .$type<string[]>()
      .notNull(),
    mediaId: text("media_id").notNull(),
    imagePath: text("image_path").notNull(),
    gifPath: text("gif_path").notNull(),
  },
  (t) => [
    index("idx_exercises_body_part").on(t.bodyPart),
    index("idx_exercises_equipment").on(t.equipment),
    index("idx_exercises_target").on(t.target),
  ],
);

/**
 * Names live here beside instructions, so adding a third language is a seed
 * change rather than a schema change. `searchText` is a lowercased haystack
 * maintained at seed time — 1,324 rows make LIKE fast enough that FTS5 would
 * be unjustified complexity.
 */
export const exerciseTranslations = sqliteTable(
  "exercise_translations",
  {
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id),
    lang: text("lang").notNull(),
    name: text("name").notNull(),
    steps: text("steps", { mode: "json" }).$type<string[]>().notNull(),
    searchText: text("search_text").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.exerciseId, t.lang] }),
    index("idx_translations_search").on(t.lang, t.searchText),
  ],
);
