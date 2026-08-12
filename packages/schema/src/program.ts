import { z } from "zod";
import { schemeSchema } from "./scheme.js";

/**
 * Request and response contracts for the program API. Shared by the Worker and
 * the client, the same arrangement the auth schemas use: a change to the shape
 * fails a test rather than breaking the UI at runtime.
 */
const name = z.string().trim().min(1).max(80);
const notes = z.string().trim().max(2000).nullish();
const id = z.string().min(1).max(64);
const restSeconds = z.number().int().min(0).max(3600).nullish();

/**
 * The program icons, by name. These were emoji until migration 0005; they are
 * now the ten glyphs of the muscle-group sheet, split into a sprite by the web
 * app's scripts/build-icons.mjs. The names are stored in `programs.icon`, so
 * this list and the generator's are one fact in two places — a test in the web
 * app asserts the generated sprite covers exactly these names.
 *
 * Validating against an enum rather than accepting any string is the point of
 * the change: an icon that does not exist in the sprite renders as nothing at
 * all, and the API is where that should be caught.
 */
export const PROGRAM_ICON_NAMES = [
  "back",
  "cardio",
  "chest",
  "forearms",
  "calves",
  "neck",
  "shoulders",
  "biceps",
  "quads",
  "core",
] as const;
export type ProgramIconName = (typeof PROGRAM_ICON_NAMES)[number];

/**
 * Preset colours are stored as their *key*, not as a hex value, so that they
 * resolve through the theme's tokens at render time — a stored "#171717" would
 * stay black when the dark theme flips ink to near-white, whereas "ink" follows
 * it. A custom colour has no token to follow and is stored as the hex the user
 * picked.
 */
export const PROGRAM_ICON_COLOR_PRESETS = ["ink", "lime", "orange", "blue", "green"] as const;
export type ProgramIconColorPreset = (typeof PROGRAM_ICON_COLOR_PRESETS)[number];

const icon = z.enum(PROGRAM_ICON_NAMES).nullish();
const iconColor = z
  .union([z.enum(PROGRAM_ICON_COLOR_PRESETS), z.string().regex(/^#[0-9a-fA-F]{6}$/)])
  .nullish();

export const createProgramSchema = z.object({ name, notes, icon, iconColor });
export type CreateProgramInput = z.infer<typeof createProgramSchema>;

/**
 * Activation goes through this endpoint rather than a dedicated /activate
 * route: it is one column, and a PATCH that sets it is easier to reason about
 * than two routes that can disagree about what "active" means. Every field is
 * optional, so an empty body is a valid no-op rather than an error.
 */
export const updateProgramSchema = z.object({
  name: name.optional(),
  notes,
  icon,
  iconColor,
  isActive: z.boolean().optional(),
  archived: z.boolean().optional(),
});
export type UpdateProgramInput = z.infer<typeof updateProgramSchema>;

export const createProgramExerciseSchema = z.object({
  exerciseId: id,
  scheme: schemeSchema,
  restSeconds,
  notes,
});
export type CreateProgramExerciseInput = z.infer<typeof createProgramExerciseSchema>;

export const updateProgramExerciseSchema = z.object({
  scheme: schemeSchema.optional(),
  restSeconds,
  notes,
});

/**
 * Reordering takes the complete ordered list rather than a from/to pair. A
 * drag-and-drop UI already knows the final order, and sending it whole makes
 * the write idempotent — replaying the same request cannot corrupt the sequence
 * the way a relative move can. The handler additionally checks the ids are
 * exactly the parent's children before writing anything.
 */
export const reorderSchema = z.object({ ids: z.array(id).min(1).max(200) });
export type ReorderInput = z.infer<typeof reorderSchema>;

export const programSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  notes: z.string().nullable(),
  /*
   * Read back as a plain string, not the enum: a row written before migration
   * 0005 — or by a future version that knows a glyph this client does not —
   * must not fail the whole response's parse. The renderer treats an unknown
   * name as "no icon" instead.
   */
  icon: z.string().nullable(),
  iconColor: z.string().nullable(),
  isActive: z.boolean(),
  archivedAt: z.number().nullable(),
  createdAt: z.number(),
  exerciseCount: z.number().int().nonnegative(),
});
export type ProgramSummary = z.infer<typeof programSummarySchema>;

/**
 * The exercise's name and image come from the library join rather than being
 * stored on the row: they are the library's facts, and duplicating them here
 * would mean a program showing a stale name after a re-seed.
 */
export const programExerciseSchema = z.object({
  id: z.string(),
  exerciseId: z.string(),
  name: z.string(),
  imagePath: z.string(),
  /** Raw taxonomy terms, untranslated: they key the load-profile rules. */
  equipment: z.string(),
  bodyPart: z.string(),
  position: z.number().int().nonnegative(),
  scheme: schemeSchema,
  restSeconds: z.number().nullable(),
  notes: z.string().nullable(),
});
export type ProgramExercise = z.infer<typeof programExerciseSchema>;

/**
 * A program IS one workout: its exercises hang directly off it. The days tier
 * was removed in phase 3d — the owner's mental model (one trainer's sheet per
 * training day) makes each "day" a program of its own.
 */
export const programDetailSchema = programSummarySchema
  .omit({ exerciseCount: true })
  .extend({ exercises: z.array(programExerciseSchema) });
export type ProgramDetail = z.infer<typeof programDetailSchema>;

export const programListResponseSchema = z.object({
  programs: z.array(programSummarySchema),
});
export type ProgramListResponse = z.infer<typeof programListResponseSchema>;

/**
 * Every create in this API answers with the new row's id and nothing else. The
 * client needs it immediately — to open the program it just made, or to attach
 * a scheme to the exercise it just added — and returning the whole row instead
 * would mean assembling a joined response for a caller that is about to
 * invalidate and refetch anyway.
 */
export const createdIdSchema = z.object({ id: z.string().min(1) });
export type CreatedId = z.infer<typeof createdIdSchema>;
