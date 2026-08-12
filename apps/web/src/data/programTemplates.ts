import type { ProgramIconColorPreset, ProgramIconName, SchemeInput } from "@podhod/schema";

export type Localized = { en: string; ru: string };

/** legs / glutes / back / arms / full body — a clean partition, unlike "upper body". */
export type TemplateTag = "legs" | "glutes" | "back" | "arms" | "fullBody";

export type TemplateExercise = { exerciseId: string; scheme: SchemeInput };

/**
 * A template is one workout, like the programs it copies into (phase 3d).
 * Multi-day splits («Фулбоди 3×», «Верх / Низ») were dropped with the days
 * tier — when they return, they return as several one-workout templates.
 */
export type ProgramTemplate = {
  /** Stable key for testids, never shown. */
  id: string;
  name: Localized;
  description: Localized;
  /** One of PROGRAM_ICON_NAMES — carried onto the copy, changeable afterwards. */
  icon: ProgramIconName;
  /** A preset key from PROGRAM_ICON_COLOR_PRESETS, carried onto the copy too. */
  iconColor: ProgramIconColorPreset;
  tags: TemplateTag[];
  exercises: TemplateExercise[];
};

const linear = (sets: number, reps: number, incrementKg: number): SchemeInput => ({
  kind: "linear",
  sets,
  reps,
  incrementKg,
  failuresBeforeDeload: 3,
  deloadPct: 0.1,
});

const double = (
  sets: number,
  repLow: number,
  repHigh: number,
  incrementKg: number,
): SchemeInput => ({ kind: "double", sets, repLow, repHigh, incrementKg });

/**
 * Exercise ids reference data/exercises.seed.json and are pinned by
 * programTemplates.test.ts — a re-seed that drops one fails the suite instead
 * of quietly shipping a template the API would reject.
 *
 * Schemes deliberately span all four kinds so the gallery doubles as a
 * showcase: linear on the compound lifts, double progression on accessories,
 * one RPE prescription and one fixed-weight entry where they genuinely fit.
 */
export const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  {
    id: "leg-day",
    name: { en: "Leg Day", ru: "День ног" },
    description: {
      en: "One focused lower-body session: squat as the anchor, then press, hinge and lunge.",
      ru: "Одна прицельная тренировка низа: присед как основа, затем жим, наклон и выпады.",
    },
    icon: "quads",
    iconColor: "lime",
    tags: ["legs"],
    exercises: [
      { exerciseId: "0043", scheme: linear(3, 5, 2.5) }, // barbell full squat
      { exerciseId: "0739", scheme: double(3, 8, 12, 5) }, // sled 45° leg press
      { exerciseId: "0085", scheme: linear(3, 8, 2.5) }, // barbell romanian deadlift
      { exerciseId: "0336", scheme: double(3, 10, 15, 2.5) }, // dumbbell lunge
      { exerciseId: "0605", scheme: double(4, 10, 15, 5) }, // lever standing calf raise
    ],
  },
  {
    id: "hips-glutes",
    name: { en: "Hips & Glutes", ru: "Ягодицы и бёдра" },
    description: {
      en: "Glute-first training: bridge, hinge, abduction and a power finisher.",
      ru: "Акцент на ягодицы: мост, наклон, отведение и мощная концовка.",
    },
    icon: "core",
    iconColor: "orange",
    tags: ["glutes", "legs"],
    exercises: [
      { exerciseId: "1409", scheme: linear(3, 8, 2.5) }, // barbell glute bridge
      { exerciseId: "1459", scheme: double(3, 8, 12, 2.5) }, // dumbbell romanian deadlift
      {
        exerciseId: "0597", // lever seated hip abduction — light isolation
        scheme: { kind: "rpe", sets: 3, reps: 15, targetRpe: 8, adjustPct: 0.05 }, // self-regulates better by feel
      },
      { exerciseId: "0431", scheme: double(3, 8, 12, 2.5) }, // dumbbell step-up
      {
        exerciseId: "0549", // kettlebell swing — kettlebells jump in fixed steps,
        scheme: { kind: "fixed", sets: 4, reps: 15, weightKg: 16 }, // so no auto-progression
      },
    ],
  },
];
