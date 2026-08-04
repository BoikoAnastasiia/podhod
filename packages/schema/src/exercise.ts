import { z } from "zod";

export const langSchema = z.enum(["en", "ru"]);
export type Lang = z.infer<typeof langSchema>;

export const listQuerySchema = z.object({
  lang: langSchema.default("en"),
  q: z.string().trim().max(100).optional(),
  bodyPart: z.string().max(40).optional(),
  equipment: z.string().max(40).optional(),
  target: z.string().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(60).default(30),
  cursor: z.string().max(8).optional(),
});
export type ListQuery = z.input<typeof listQuerySchema>;

export const listItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  bodyPart: z.string(),
  equipment: z.string(),
  target: z.string(),
  imagePath: z.string(),
});
export type ExerciseListItem = z.infer<typeof listItemSchema>;

export const listResponseSchema = z.object({
  items: z.array(listItemSchema),
  nextCursor: z.string().nullable(),
});
export type ListResponse = z.infer<typeof listResponseSchema>;

export const detailSchema = listItemSchema.extend({
  muscleGroup: z.string(),
  secondaryMuscles: z.array(z.string()),
  gifPath: z.string(),
  steps: z.array(z.string()),
});
export type ExerciseDetail = z.infer<typeof detailSchema>;
