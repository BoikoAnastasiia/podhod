import { z } from "zod";

/**
 * The wire and storage contract for program_exercises.scheme_config. The engine
 * in @podhod/core owns the TypeScript types; this owns validation, so the scheme
 * editor and the API agree on what a valid scheme is without either importing
 * the other's internals.
 *
 * Percentages are fractions (0.1 = 10%), never whole numbers. Storing 10 and
 * meaning 10% is how these values end up multiplied by a hundred somewhere
 * downstream.
 */
const positiveInt = z.number().int().positive();
const weight = z.number().positive();
const fraction = z.number().gt(0).lt(1);

export const schemeFixedSchema = z.object({
  kind: z.literal("fixed"),
  sets: positiveInt.max(20),
  reps: positiveInt.max(100),
  weightKg: weight.max(1000),
});

export const schemeLinearSchema = z.object({
  kind: z.literal("linear"),
  sets: positiveInt.max(20),
  reps: positiveInt.max(100),
  incrementKg: weight.max(50),
  failuresBeforeDeload: positiveInt.max(10),
  deloadPct: fraction,
});

export const schemeDoubleSchema = z
  .object({
    kind: z.literal("double"),
    sets: positiveInt.max(20),
    repLow: positiveInt.max(100),
    repHigh: positiveInt.max(100),
    incrementKg: weight.max(50),
  })
  .refine((s) => s.repHigh > s.repLow, {
    message: "repHigh must be greater than repLow",
    path: ["repHigh"],
  });

export const schemeRpeSchema = z.object({
  kind: z.literal("rpe"),
  sets: positiveInt.max(20),
  reps: positiveInt.max(100),
  // RPE is a 1-10 scale and half-points are meaningful ("RPE 8.5"), so this is
  // deliberately not an integer.
  targetRpe: z.number().min(1).max(10),
  adjustPct: fraction,
});

export const schemeSchema = z.discriminatedUnion("kind", [
  schemeFixedSchema,
  schemeLinearSchema,
  schemeDoubleSchema,
  schemeRpeSchema,
]);

export type SchemeInput = z.infer<typeof schemeSchema>;

/**
 * scheme_config is a TEXT column holding JSON, so reading it has two failure
 * modes — malformed JSON and well-formed JSON of the wrong shape. Both return
 * the same discriminated result rather than throwing, because a single corrupt
 * row must not take down a whole program's page.
 */
export function parseSchemeConfig(
  raw: string,
): { ok: true; scheme: SchemeInput } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "scheme_config is not valid JSON" };
  }
  const result = schemeSchema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue?.path.join(".");
    return { ok: false, error: where ? `scheme_config ${where}` : "scheme_config" };
  }
  return { ok: true, scheme: result.data };
}
