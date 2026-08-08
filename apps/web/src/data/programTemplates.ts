import type { SchemeInput } from "@podhod/schema";

export type Localized = { en: string; ru: string };

/** legs / glutes / back / arms / full body — a clean partition, unlike "upper body". */
export type TemplateTag = "legs" | "glutes" | "back" | "arms" | "fullBody";

export type TemplateExercise = { exerciseId: string; scheme: SchemeInput };
export type TemplateDay = { name: Localized; exercises: TemplateExercise[] };

export type ProgramTemplate = {
  /** Stable key for testids, never shown. */
  id: string;
  name: Localized;
  description: Localized;
  /** One of PROGRAM_ICONS — carried onto the copy, changeable afterwards. */
  icon: string;
  tags: TemplateTag[];
  days: TemplateDay[];
};

/**
 * The preset row the IconPicker offers; templates draw from the same set.
 * Emoji rather than an icon library: zero dependencies, and the parked design
 * pass can swap these for real iconography without touching the data model.
 */
export const PROGRAM_ICONS = [
  "💪",
  "🦵",
  "🍑",
  "🏋️",
  "🤸",
  "🏃",
  "⚡",
  "🔥",
  "🧘",
  "❤️",
] as const;

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
    icon: "🦵",
    tags: ["legs"],
    days: [
      {
        name: { en: "Leg day", ru: "День ног" },
        exercises: [
          { exerciseId: "0043", scheme: linear(3, 5, 2.5) }, // barbell full squat
          { exerciseId: "0739", scheme: double(3, 8, 12, 5) }, // sled 45° leg press
          { exerciseId: "0085", scheme: linear(3, 8, 2.5) }, // barbell romanian deadlift
          { exerciseId: "0336", scheme: double(3, 10, 15, 2.5) }, // dumbbell lunge
          { exerciseId: "0605", scheme: double(4, 10, 15, 5) }, // lever standing calf raise
        ],
      },
    ],
  },
  {
    id: "hips-glutes",
    name: { en: "Hips & Glutes", ru: "Ягодицы и бёдра" },
    description: {
      en: "Glute-first training: bridge, hinge, abduction and a power finisher.",
      ru: "Акцент на ягодицы: мост, наклон, отведение и мощная концовка.",
    },
    icon: "🍑",
    tags: ["glutes", "legs"],
    days: [
      {
        name: { en: "Hips & glutes", ru: "Ягодицы и бёдра" },
        exercises: [
          { exerciseId: "1409", scheme: linear(3, 8, 2.5) }, // barbell glute bridge
          { exerciseId: "1459", scheme: double(3, 8, 12, 2.5) }, // dumbbell romanian deadlift
          { exerciseId: "0597", scheme: double(3, 12, 20, 2.5) }, // lever seated hip abduction
          { exerciseId: "0431", scheme: double(3, 8, 12, 2.5) }, // dumbbell step-up
          {
            exerciseId: "0549", // kettlebell swing — kettlebells jump in fixed steps,
            scheme: { kind: "fixed", sets: 3, reps: 15, weightKg: 16 }, // so no auto-progression
          },
        ],
      },
    ],
  },
  {
    id: "full-body-3x",
    name: { en: "Full Body 3×", ru: "Фулбоди 3×" },
    description: {
      en: "Three alternating full-body days built on the big barbell lifts.",
      ru: "Три чередующихся дня на всё тело вокруг базовых движений со штангой.",
    },
    icon: "⚡",
    tags: ["fullBody"],
    days: [
      {
        name: { en: "Day A", ru: "День A" },
        exercises: [
          { exerciseId: "0043", scheme: linear(3, 5, 2.5) }, // barbell full squat
          { exerciseId: "0025", scheme: linear(3, 5, 2.5) }, // barbell bench press
          { exerciseId: "0861", scheme: double(3, 8, 12, 2.5) }, // cable seated row
        ],
      },
      {
        name: { en: "Day B", ru: "День B" },
        exercises: [
          { exerciseId: "0032", scheme: linear(1, 5, 5) }, // barbell deadlift — one heavy set
          { exerciseId: "0091", scheme: linear(3, 5, 2.5) }, // barbell seated overhead press
          { exerciseId: "0198", scheme: double(3, 8, 12, 2.5) }, // cable pulldown
        ],
      },
      {
        name: { en: "Day C", ru: "День C" },
        exercises: [
          { exerciseId: "1760", scheme: double(3, 8, 12, 2.5) }, // dumbbell goblet squat
          { exerciseId: "0289", scheme: double(3, 8, 12, 2.5) }, // dumbbell bench press
          { exerciseId: "0293", scheme: double(3, 8, 12, 2.5) }, // dumbbell bent over row
        ],
      },
    ],
  },
  {
    id: "upper-lower",
    name: { en: "Upper / Lower", ru: "Верх / Низ" },
    description: {
      en: "A four-day split: two upper-body and two lower-body sessions a week.",
      ru: "Сплит на четыре дня: две тренировки верха и две — низа в неделю.",
    },
    icon: "🏋️",
    tags: ["fullBody", "back", "arms", "legs"],
    days: [
      {
        name: { en: "Upper A", ru: "Верх A" },
        exercises: [
          { exerciseId: "0025", scheme: linear(3, 5, 2.5) }, // barbell bench press
          { exerciseId: "0027", scheme: linear(3, 5, 2.5) }, // barbell bent over row
          { exerciseId: "0091", scheme: double(3, 8, 12, 2.5) }, // barbell seated overhead press
          {
            exerciseId: "0334", // dumbbell lateral raise — light isolation self-regulates
            scheme: { kind: "rpe", sets: 3, reps: 12, targetRpe: 8, adjustPct: 0.05 }, // better by feel
          },
          { exerciseId: "0294", scheme: double(3, 8, 12, 2.5) }, // dumbbell biceps curl
        ],
      },
      {
        name: { en: "Lower A", ru: "Низ A" },
        exercises: [
          { exerciseId: "0043", scheme: linear(3, 5, 2.5) }, // barbell full squat
          { exerciseId: "0085", scheme: linear(3, 8, 2.5) }, // barbell romanian deadlift
          { exerciseId: "0585", scheme: double(3, 10, 15, 2.5) }, // lever leg extension
          { exerciseId: "0594", scheme: double(4, 10, 15, 5) }, // lever seated calf raise
        ],
      },
      {
        name: { en: "Upper B", ru: "Верх B" },
        exercises: [
          { exerciseId: "0047", scheme: double(3, 8, 12, 2.5) }, // barbell incline bench press
          { exerciseId: "0198", scheme: double(3, 8, 12, 2.5) }, // cable pulldown
          { exerciseId: "0603", scheme: double(3, 8, 12, 2.5) }, // lever shoulder press
          { exerciseId: "0241", scheme: double(3, 10, 15, 2.5) }, // cable triceps pushdown (v-bar)
        ],
      },
      {
        name: { en: "Lower B", ru: "Низ B" },
        exercises: [
          { exerciseId: "0032", scheme: linear(1, 5, 5) }, // barbell deadlift — one heavy set
          { exerciseId: "0739", scheme: double(3, 8, 12, 5) }, // sled 45° leg press
          { exerciseId: "0599", scheme: double(3, 10, 15, 2.5) }, // lever seated leg curl
          { exerciseId: "0605", scheme: double(4, 10, 15, 5) }, // lever standing calf raise
        ],
      },
    ],
  },
];
