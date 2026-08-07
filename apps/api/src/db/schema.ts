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

/**
 * A training program: an ordered set of days, each an ordered set of exercises
 * with a progression scheme. Programs are edited constantly, which is why a
 * workout will snapshot its plan rather than pointing at these rows — see
 * docs/design.md §3.
 *
 * `archivedAt` rather than a delete: history references programs by name long
 * after they stop being followed, and a DELETE would make old sessions
 * unreadable.
 *
 * `isActive` is 0/1 rather than a boolean because the partial unique index
 * that enforces one active program per user is written against the integer.
 * That index lives in the migration by hand — drizzle-kit does not emit
 * partial indexes — and it is what actually enforces the rule: two concurrent
 * activations both pass an application-level check and both write.
 */
export const programs = sqliteTable(
  "programs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    notes: text("notes"),
    isActive: integer("is_active").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    archivedAt: integer("archived_at"),
  },
  (t) => [index("idx_programs_user").on(t.userId)],
);

export const programDays = sqliteTable(
  "program_days",
  {
    id: text("id").primaryKey(),
    programId: text("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    name: text("name").notNull(),
  },
  (t) => [index("idx_program_days_program").on(t.programId, t.position)],
);

/**
 * `schemeConfig` is TEXT holding JSON rather than a column per scheme field:
 * the four schemes share almost nothing, so columns would be mostly NULL and
 * every read would need to know which ones apply. It is validated against
 * `schemeSchema` on the way in and parsed with `parseSchemeConfig` on the way
 * out, so stored JSON is never trusted merely because it is already stored.
 *
 * `schemeType` duplicates `scheme.kind` deliberately: it is written from the
 * JSON at every write, and exists only so a query like "every exercise I train
 * with double progression" does not have to parse JSON in SQL.
 */
export const programExercises = sqliteTable(
  "program_exercises",
  {
    id: text("id").primaryKey(),
    programDayId: text("program_day_id")
      .notNull()
      .references(() => programDays.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id),
    position: integer("position").notNull(),
    schemeType: text("scheme_type").notNull(),
    schemeConfig: text("scheme_config").notNull(),
    restSeconds: integer("rest_seconds"),
    notes: text("notes"),
  },
  (t) => [index("idx_program_exercises_day").on(t.programDayId, t.position)],
);
