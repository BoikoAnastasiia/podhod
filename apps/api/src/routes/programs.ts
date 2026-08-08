import type { ErrorResponse } from "@podhod/schema";
import {
  createProgramSchema,
  errorResponseSchema,
  programListResponseSchema,
  updateProgramSchema,
} from "@podhod/schema";
import { and, count, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { programDays, programs } from "../db/schema.js";
import { findOwnedProgram } from "../lib/ownership.js";
import type { AuthedEnv } from "../lib/session.js";
import { requireSession } from "../lib/session.js";

const fail = (code: ErrorResponse["error"]["code"], message: string) =>
  errorResponseSchema.parse({ error: { code, message } } satisfies ErrorResponse);

/**
 * Ids are generated here rather than by the database: D1 has no UUID function,
 * and an application-generated id is known before the insert, which keeps a
 * create to one round trip instead of an insert followed by a read-back.
 */
const newId = () => crypto.randomUUID();

/**
 * `created_at` is milliseconds since the epoch, written at the edge. This is
 * the one place in the app allowed to read a clock — packages/core is pure
 * precisely so that the rules operating on this data never have to.
 */
const now = () => Date.now();

export const programRoutes = new Hono<AuthedEnv>()
  .use("*", requireSession())

  .get("/", async (c) => {
    const db = drizzle(c.env.DB);
    const userId = c.get("session").user.id;

    // One grouped join rather than a query per program: a user with twenty
    // programs would otherwise cost twenty round trips to D1.
    const rows = await db
      .select({
        id: programs.id,
        name: programs.name,
        notes: programs.notes,
        isActive: programs.isActive,
        archivedAt: programs.archivedAt,
        createdAt: programs.createdAt,
        dayCount: count(programDays.id),
      })
      .from(programs)
      .leftJoin(programDays, eq(programDays.programId, programs.id))
      .where(eq(programs.userId, userId))
      .groupBy(programs.id)
      .orderBy(programs.createdAt);

    return c.json(
      programListResponseSchema.parse({
        programs: rows.map((r) => ({ ...r, isActive: r.isActive === 1 })),
      }),
    );
  })

  .post("/", async (c) => {
    const parsed = createProgramSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json(fail("bad_request", "invalid program"), 400);

    const db = drizzle(c.env.DB);
    const id = newId();
    await db.insert(programs).values({
      id,
      userId: c.get("session").user.id,
      name: parsed.data.name,
      notes: parsed.data.notes ?? null,
      isActive: 0,
      createdAt: now(),
    });

    return c.json({ id }, 201);
  })

  .patch("/:id", async (c) => {
    const parsed = updateProgramSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json(fail("bad_request", "invalid program"), 400);

    const db = drizzle(c.env.DB);
    const userId = c.get("session").user.id;
    const existing = await findOwnedProgram(db, userId, c.req.param("id"));
    if (!existing) return c.json(fail("not_found", "no such program"), 404);

    const { name, notes, isActive, archived } = parsed.data;
    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = name;
    if (notes !== undefined) patch.notes = notes ?? null;

    /**
     * Archiving always clears `isActive`. An archived program still flagged
     * active would occupy the one-active-per-user slot enforced by the partial
     * unique index, and quietly block activating anything else — with no
     * visible cause, since the offending program is filed away.
     */
    if (archived !== undefined) {
      patch.archivedAt = archived ? now() : null;
      if (archived) patch.isActive = 0;
    }

    /**
     * Activation is two writes that must happen together and in this order:
     * clear whatever is active, then set this one. Setting first collides with
     * the row still holding the slot. D1 offers no interactive transaction, so
     * this uses `db.batch()`, which the platform executes atomically.
     */
    if (isActive === true && archived !== true) {
      await db.batch([
        db
          .update(programs)
          .set({ isActive: 0 })
          .where(and(eq(programs.userId, userId), eq(programs.isActive, 1))),
        db
          .update(programs)
          .set({ ...patch, isActive: 1 })
          .where(eq(programs.id, existing.id)),
      ]);
      return c.body(null, 204);
    }

    if (isActive === false) patch.isActive = 0;

    if (Object.keys(patch).length > 0) {
      await db.update(programs).set(patch).where(eq(programs.id, existing.id));
    }
    return c.body(null, 204);
  })

  .delete("/:id", async (c) => {
    const db = drizzle(c.env.DB);
    const userId = c.get("session").user.id;
    const existing = await findOwnedProgram(db, userId, c.req.param("id"));
    if (!existing) return c.json(fail("not_found", "no such program"), 404);

    // Days and their exercises go with it, by ON DELETE CASCADE.
    await db.delete(programs).where(eq(programs.id, existing.id));
    return c.body(null, 204);
  });
