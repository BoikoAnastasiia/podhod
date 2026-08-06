import { index, primaryKey, real, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema.js";

/**
 * `user`, `session`, `account` and `verification` below come from
 * `auth-schema.ts`, which is generated output, not hand-written — see that
 * file's own header. Re-exported here so drizzle-kit and every other caller
 * has one schema module to import, matching the pattern the rest of this
 * file already uses for the library tables.
 */
export * from "./auth-schema.js";

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

/**
 * One row per user, per docs/design.md §3. `userId` is the primary key
 * rather than a separate surrogate one — the relationship is 1:1 and always
 * will be, so there is no case where a second row for the same user is
 * meaningful. Created by the `databaseHooks.user.create.after` hook in
 * src/lib/auth.ts the moment an account exists, with every column but
 * `userId` left to its SQL default, so the client never has to handle a
 * signed-in user with no settings row yet.
 */
export const userSettings = sqliteTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  locale: text("locale").notNull().default("en"),
  units: text("units").notNull().default("kg"),
  plateIncrementKg: real("plate_increment_kg").notNull().default(2.5),
  defaultRestSeconds: integer("default_rest_seconds").notNull().default(90),
  theme: text("theme").notNull().default("system"),
});
