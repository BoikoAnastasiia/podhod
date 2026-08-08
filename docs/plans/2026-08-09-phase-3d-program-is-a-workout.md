# Подход Phase 3d — A Program Is a Workout

**Goal:** Restructure the model to match how the owner actually trains: a program is one workout — a named, iconed list of exercises with weights — not a container of days. Her trainer wrote one sheet per day: exercises, weights, sets. The days tier goes away everywhere.

**Decisions (owner, 2026-08-09):**
- **Days are removed entirely** — database, API, contracts, UI. The programs list is the week overview; «monday» is a program.
- **"4" means 4 sets (подхода).** Adding an exercise defaults to a fixed scheme of 4 sets × 10 reps; the visible, immediately editable field is the **weight** — the trainer-sheet experience.
- **Schemes stay as the power tool.** The instant add writes `fixed 4×10`; «Изменить схему» still offers all four progression kinds. The engine is untouched.
- **Templates become single workouts.** «День ног» and «Ягодицы и бёдра» remain; «Фулбоди 3×» and «Верх / Низ» are dropped (more one-workout templates can come later). The RPE showcase moves into «Ягодицы и бёдра» so the gallery still spans all four scheme kinds.
- Existing day names are test data only (the programs UI has never been pushed); the migration discards them knowingly.

**Architecture:** Migration `0004` rebuilds `program_exercises` with a direct `program_id` (positions renumbered day-order-then-exercise-order via `ROW_NUMBER()`), then drops `program_days`. The API loses all `/days` routes; exercises hang off `/programs/:id/exercises`. The web's `DayEditor` dissolves into `ProgramEditor`. Fixed-scheme rows render the weight as an inline input that PATCHes on commit; other kinds render the existing summary.

## Global Constraints

Unchanged from 3b/3c: no new dependencies, tokens only, all strings bilingual via `useI18n()`, invalidate-don't-patch, `run` in pnpm filters, grep built CSS for new utilities, never regenerate migrations (partial index in `0002`).

---

## Tasks

**1. Contracts** (`packages/schema/src/program.ts` + tests): `programSummarySchema.dayCount` → `exerciseCount`; `programDetailSchema` carries `exercises: programExerciseSchema[]` directly (no `days`); `createDaySchema`/`updateDaySchema`/`programDaySchema` deleted. Commit: "Make a program a flat list of exercises in the contracts".

**2. Database and API** (`apps/api`): migration `0004_program_is_a_workout.sql` —

```sql
CREATE TABLE `program_exercises_new` (
  `id` text PRIMARY KEY NOT NULL,
  `program_id` text NOT NULL REFERENCES `programs`(`id`) ON DELETE CASCADE,
  `exercise_id` text NOT NULL REFERENCES `exercises`(`id`),
  `position` integer NOT NULL,
  `scheme_type` text NOT NULL,
  `scheme_config` text NOT NULL,
  `rest_seconds` integer,
  `notes` text
);
INSERT INTO `program_exercises_new`
SELECT pe.`id`, pd.`program_id`, pe.`exercise_id`,
  ROW_NUMBER() OVER (PARTITION BY pd.`program_id` ORDER BY pd.`position`, pe.`position`) - 1,
  pe.`scheme_type`, pe.`scheme_config`, pe.`rest_seconds`, pe.`notes`
FROM `program_exercises` pe JOIN `program_days` pd ON pd.`id` = pe.`program_day_id`;
DROP TABLE `program_exercises`;
ALTER TABLE `program_exercises_new` RENAME TO `program_exercises`;
CREATE INDEX `idx_program_exercises_program` ON `program_exercises` (`program_id`,`position`);
DROP TABLE `program_days`;
```

`db/schema.ts` drops `programDays`, repoints `programExercises.programId`. Routes: list counts exercises; detail joins entries directly; `/days/*` routes deleted; `POST /:id/exercises`, `PUT /:id/exercises/order` replace the day-scoped ones; entry delete renumbers within the program. `lib/ownership.ts` loses `findOwnedDay`; `findOwnedProgramExercise` joins `programs` directly. Tests: `program-days.test.ts` deleted; `program-exercises`, `program-ownership`, `program-crud`, `programs` updated to the flat shape. Commit: "Collapse days: exercises belong to the program".

**3. Web client and editor** (`apps/web`): `api.ts` drops day fns; `addExercise(programId, …)`, `reorderExercises(programId, …)`. `SCHEME_DEFAULTS.fixed` becomes `4×10 · 20 kg` and the instant add uses it (a new exercise reads "4×10", weight prominent). `DayEditor.tsx` deleted; `ProgramEditor.tsx` owns the entry rows: fixed-scheme rows show `4×10` plus an **inline weight input** (`data-testid="entry-weight"`, aria-label from `scheme.field.weightKg`, saves on blur/Enter via `updateExercise`), other kinds show `SchemeSummary`; reorder/edit/remove as before. Dict: all `days.*` keys deleted; `entries.empty` / `entries.emptyHint` added; `programs.dayCount.zero` → `programs.exerciseCount.zero`; list cards count exercises with `exerciseNounForms`. Commit: "Edit a program as one flat workout".

**4. Templates** (`apps/web/src/data/programTemplates.ts`): `TemplateDay` deleted — a template carries `exercises` directly. Keep `leg-day`, `hips-glutes`; hip abduction becomes `rpe 3×15 @ 8 ±5%` so all four kinds survive; kettlebell swing stays fixed (4×15 · 16 kg). `materializeTemplate` loses the day loop. Gallery meta line: exercise count only. Validation tests updated (kind-span test still expects all four). Commit: "Reshape the templates as single workouts".

**5. E2e** (`apps/web/e2e/programs.spec.ts`): the build test creates a program and adds exercises directly (no add-day), edits a weight inline and asserts it survives reload; template test expects 5 entries in «Leg Day»; mobile test adds an exercise instead of a day. Commit: "Cover the flat program flow end to end".

**6. Docs**: NEXT-STEPS updated; this plan gets its progress note. Commit: "Record the workout-shaped model in the docs".
