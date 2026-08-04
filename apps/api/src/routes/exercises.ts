import { detailSchema, listQuerySchema, type Lang } from "@podhod/schema";
import { and, asc, eq, gt, like, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { exercises, exerciseTranslations } from "../db/schema.js";

type Env = { Bindings: { DB: D1Database } };

export const exerciseRoutes = new Hono<Env>()
  .get("/", async (c) => {
    const parsed = listQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      return c.json(
        { error: { code: "bad_request", message: parsed.error.message } },
        400,
      );
    }
    const { lang, q, bodyPart, equipment, target, limit, cursor } = parsed.data;
    const db = drizzle(c.env.DB);

    const where: SQL[] = [eq(exerciseTranslations.lang, lang)];
    if (q) where.push(like(exerciseTranslations.searchText, `%${q.toLowerCase()}%`));
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
  .get("/:id", async (c) => {
    const lang = (c.req.query("lang") === "ru" ? "ru" : "en") satisfies Lang;
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
      return c.json(
        { error: { code: "not_found", message: "exercise not found" } },
        404,
      );
    }
    return c.json(detailSchema.parse(row));
  });
