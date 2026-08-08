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

export const createProgramSchema = z.object({ name, notes });
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
  isActive: z.boolean().optional(),
  archived: z.boolean().optional(),
});
export type UpdateProgramInput = z.infer<typeof updateProgramSchema>;

export const createDaySchema = z.object({ name });
export const updateDaySchema = z.object({ name });

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
  isActive: z.boolean(),
  archivedAt: z.number().nullable(),
  createdAt: z.number(),
  dayCount: z.number().int().nonnegative(),
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
  position: z.number().int().nonnegative(),
  scheme: schemeSchema,
  restSeconds: z.number().nullable(),
  notes: z.string().nullable(),
});
export type ProgramExercise = z.infer<typeof programExerciseSchema>;

export const programDaySchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.number().int().nonnegative(),
  exercises: z.array(programExerciseSchema),
});
export type ProgramDay = z.infer<typeof programDaySchema>;

export const programDetailSchema = programSummarySchema
  .omit({ dayCount: true })
  .extend({ days: z.array(programDaySchema) });
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
