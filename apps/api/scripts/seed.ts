import type { SeedExercise } from "../../../data/src/transform.js";

export type ExerciseRow = {
  id: string;
  bodyPart: string;
  equipment: string;
  target: string;
  muscleGroup: string;
  secondaryMuscles: string[];
  mediaId: string;
  imagePath: string;
  gifPath: string;
};

export type TranslationRow = {
  exerciseId: string;
  lang: "en" | "ru";
  name: string;
  steps: string[];
  searchText: string;
};

const searchText = (name: string, target: string, equipment: string) =>
  `${name} ${target} ${equipment}`.toLowerCase();

export function buildRows(
  seed: SeedExercise[],
  taxonomyRu: Record<string, string>,
): { exercises: ExerciseRow[]; translations: TranslationRow[] } {
  const exercises: ExerciseRow[] = [];
  const translations: TranslationRow[] = [];
  const ru = (term: string) => taxonomyRu[term] ?? term;

  for (const e of seed) {
    exercises.push({
      id: e.id,
      bodyPart: e.body_part,
      equipment: e.equipment,
      target: e.target,
      muscleGroup: e.muscle_group,
      secondaryMuscles: e.secondary_muscles,
      mediaId: e.media_id,
      imagePath: e.image,
      gifPath: e.gif_url,
    });

    translations.push({
      exerciseId: e.id,
      lang: "en",
      name: e.name,
      steps: e.steps_en,
      searchText: searchText(e.name, e.target, e.equipment),
    });
    // The name stays English in both locales — see the Task 3 CUT record.
    // Russian search still works because the haystack carries translated
    // taxonomy terms alongside the English name.
    translations.push({
      exerciseId: e.id,
      lang: "ru",
      name: e.name,
      steps: e.steps_ru,
      searchText: searchText(e.name, ru(e.target), ru(e.equipment)),
    });
  }

  return { exercises, translations };
}

/** Emits a .sql file so seeding uses `wrangler d1 execute` on both local and remote. */
export function toSql(rows: ReturnType<typeof buildRows>): string {
  const q = (v: string) => `'${v.replace(/'/g, "''")}'`;
  const lines = ["DELETE FROM exercise_translations;", "DELETE FROM exercises;"];

  // Column lists are explicit on purpose. A positional INSERT would silently
  // bind the wrong values if a future migration reorders or inserts a column,
  // and SQLite would accept it as long as the arity matched.
  for (const e of rows.exercises) {
    lines.push(
      "INSERT INTO exercises (id, body_part, equipment, target, muscle_group, " +
        "secondary_muscles, media_id, image_path, gif_path) VALUES (" +
        `${q(e.id)},${q(e.bodyPart)},${q(e.equipment)},${q(e.target)},` +
        `${q(e.muscleGroup)},${q(JSON.stringify(e.secondaryMuscles))},` +
        `${q(e.mediaId)},${q(e.imagePath)},${q(e.gifPath)});`,
    );
  }
  for (const t of rows.translations) {
    lines.push(
      "INSERT INTO exercise_translations (exercise_id, lang, name, steps, " +
        `search_text) VALUES (${q(t.exerciseId)},${q(t.lang)},${q(t.name)},` +
        `${q(JSON.stringify(t.steps))},${q(t.searchText)});`,
    );
  }
  return lines.join("\n");
}
