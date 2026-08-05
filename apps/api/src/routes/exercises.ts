import {
  countResponseSchema,
  detailSchema,
  errorResponseSchema,
  formatValidationError,
  langQuerySchema,
  listQuerySchema,
} from "@podhod/schema";
import type { ErrorResponse } from "@podhod/schema";
import { and, asc, eq, gt, sql, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { exercises, exerciseTranslations } from "../db/schema.js";

type Env = { Bindings: { DB: D1Database } };

/**
 * A short, safe message for a failed query-param parse — never the raw Zod
 * issue dump, which is multi-line and echoes the caller's input back at
 * them.
 */
function badRequestBody(error: Parameters<typeof formatValidationError>[0]): ErrorResponse {
  return errorResponseSchema.parse({
    error: { code: "bad_request", message: formatValidationError(error) },
  });
}

function notFoundBody(message: string): ErrorResponse {
  return errorResponseSchema.parse({ error: { code: "not_found", message } });
}

/** Escapes LIKE wildcards so a literal `%` or `_` in `q` cannot broaden the match. */
function escapeLike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export const exerciseRoutes = new Hono<Env>()
  .get("/", async (c) => {
    const parsed = listQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      return c.json(badRequestBody(parsed.error), 400);
    }
    const { lang, q, bodyPart, equipment, target, limit, cursor } = parsed.data;
    const db = drizzle(c.env.DB);

    const where: SQL[] = [eq(exerciseTranslations.lang, lang)];
    if (q) {
      const pattern = `%${escapeLike(q.toLowerCase())}%`;
      where.push(sql`${exerciseTranslations.searchText} LIKE ${pattern} ESCAPE '\\'`);
    }
    if (bodyPart) where.push(eq(exercises.bodyPart, bodyPart));
    if (equipment) where.push(eq(exercises.equipment, equipment));
    if (target) where.push(eq(exercises.target, target));
    if (cursor) where.push(gt(exercises.id, cursor));

    // Fetch one extra row to decide whether another page exists.
    const rows = await db
      .select({
        id: exercises.id,
        name: exerciseTranslations.name,
        bodyPart: exercises.bodyPart,
        equipment: exercises.equipment,
        target: exercises.target,
        imagePath: exercises.imagePath,
      })
      .from(exercises)
      .innerJoin(
        exerciseTranslations,
        eq(exerciseTranslations.exerciseId, exercises.id),
      )
      .where(and(...where))
      .orderBy(asc(exercises.id))
      .limit(limit + 1);

    const items = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? (items.at(-1)?.id ?? null) : null;
    return c.json({ items, nextCursor });
  })
  // Declared before "/:id" so a literal "/count" resolves here rather than
  // being captured as an exercise id — Hono's router prefers a static
  // segment over a param one regardless of registration order, but the
  // order still reads correctly for a human scanning the route list.
  .get("/count", async (c) => {
    const db = drizzle(c.env.DB);
    const [row] = await db.select({ total: sql<number>`count(*)` }).from(exercises);
    return c.json(countResponseSchema.parse({ total: Number(row?.total ?? 0) }));
  })
  .get("/:id", async (c) => {
    const parsedLang = langQuerySchema.safeParse(c.req.query("lang"));
    if (!parsedLang.success) {
      return c.json(badRequestBody(parsedLang.error), 400);
    }
    const lang = parsedLang.data;
    const db = drizzle(c.env.DB);

    const [row] = await db
      .select({
        id: exercises.id,
        name: exerciseTranslations.name,
        bodyPart: exercises.bodyPart,
        equipment: exercises.equipment,
        target: exercises.target,
        imagePath: exercises.imagePath,
        muscleGroup: exercises.muscleGroup,
        secondaryMuscles: exercises.secondaryMuscles,
        gifPath: exercises.gifPath,
        steps: exerciseTranslations.steps,
      })
      .from(exercises)
      .innerJoin(
        exerciseTranslations,
        eq(exerciseTranslations.exerciseId, exercises.id),
      )
      .where(
        and(eq(exercises.id, c.req.param("id")), eq(exerciseTranslations.lang, lang)),
      )
      .limit(1);

    if (!row) {
      return c.json(notFoundBody("exercise not found"), 404);
    }
    return c.json(detailSchema.parse(row));
  });
