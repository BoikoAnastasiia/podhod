import { z } from "zod";

export const langSchema = z.enum(["en", "ru"]);
export type Lang = z.infer<typeof langSchema>;

/**
 * An unset query param (`undefined`) and an explicitly empty one (`?lang=`)
 * mean the same thing to a caller that builds `URLSearchParams` from a state
 * object — so both fall through to the same default instead of failing
 * validation.
 */
const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

/**
 * Parses a raw `lang` query value the same way in every route that accepts
 * one, so an invalid language is rejected identically everywhere rather than
 * silently substituted in some handlers and enforced in others.
 */
export const langQuerySchema = z.preprocess(emptyToUndefined, langSchema.default("en"));

export const listQuerySchema = z.object({
  lang: langQuerySchema,
  q: z.string().trim().max(100).optional(),
  bodyPart: z.string().max(40).optional(),
  equipment: z.string().max(40).optional(),
  target: z.string().max(40).optional(),
  limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(60).default(30)),
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

/**
 * The library size shown on the landing page. A separate endpoint rather than
 * a `total` field folded into `listResponseSchema`, because every list query
 * is already filtered and paginated — counting the *whole* library from
 * inside that route would mean a second, differently-filtered query hiding
 * inside a handler whose job is otherwise "return this page." One count, one
 * unfiltered query, one route.
 */
export const countResponseSchema = z.object({
  total: z.number().int().nonnegative(),
});
export type CountResponse = z.infer<typeof countResponseSchema>;

export const detailSchema = listItemSchema.extend({
  muscleGroup: z.string(),
  secondaryMuscles: z.array(z.string()),
  gifPath: z.string(),
  steps: z.array(z.string()),
});
export type ExerciseDetail = z.infer<typeof detailSchema>;

/**
 * The one error envelope every route returns. `message` is always a short,
 * human string — never a raw Zod issue dump, which is multi-line and echoes
 * the caller's input back at them. Exported so downstream tasks parse a
 * shared shape instead of hand-rolling their own error type.
 */
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.enum(["bad_request", "not_found", "internal"]),
    message: z.string(),
  }),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

/**
 * Turns a failed parse into the one-line `message` the client actually sees.
 * Lives here rather than in each route so a route never needs `zod` as a
 * direct dependency just to name the `ZodError` type — it only ever touches
 * the `SafeParseError` its own schema produces.
 */
export function formatValidationError(error: z.ZodError): string {
  const field = error.issues[0]?.path.join(".") || "request";
  return `invalid ${field}`;
}
