import type { ErrorResponse } from "@podhod/schema";
import {
  createDaySchema,
  createProgramSchema,
  errorResponseSchema,
  programDetailSchema,
  programListResponseSchema,
  reorderSchema,
  updateDaySchema,
  updateProgramSchema,
} from "@podhod/schema";
import type { BatchItem } from "drizzle-orm/batch";
import { and, asc, count, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { programDays, programs } from "../db/schema.js";
import { findOwnedDay, findOwnedProgram } from "../lib/ownership.js";
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
 * `db.batch()` is typed as a non-empty tuple, which an array built by `map`
 * cannot satisfy on its own. This narrows it once, in a place where the
 * emptiness check is right next to the assertion, rather than casting at each
 * call site — an empty batch is a no-op worth skipping anyway.
 */
type Batch = BatchItem<"sqlite">;
async function runBatch(
  db: ReturnType<typeof drizzle>,
  statements: Batch[],
): Promise<void> {
  if (statements.length === 0) return;
  await db.batch(statements as [Batch, ...Batch[]]);
}

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
  })

  /**
   * Registered before `/:id` for readability rather than necessity — Hono
   * matches on segment count, and `/days/:dayId` is two segments where `/:id`
   * is one, so they cannot collide.
   */
  .patch("/days/:dayId", async (c) => {
    const parsed = updateDaySchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json(fail("bad_request", "invalid day"), 400);

    const db = drizzle(c.env.DB);
    const day = await findOwnedDay(db, c.get("session").user.id, c.req.param("dayId"));
    if (!day) return c.json(fail("not_found", "no such day"), 404);

    await db.update(programDays).set({ name: parsed.data.name }).where(eq(programDays.id, day.id));
    return c.body(null, 204);
  })

  .delete("/days/:dayId", async (c) => {
    const db = drizzle(c.env.DB);
    const day = await findOwnedDay(db, c.get("session").user.id, c.req.param("dayId"));
    if (!day) return c.json(fail("not_found", "no such day"), 404);

    const remaining = (
      await db
        .select({ id: programDays.id })
        .from(programDays)
        .where(eq(programDays.programId, day.programId))
        .orderBy(asc(programDays.position))
    ).filter((d) => d.id !== day.id);

    // Deleting from the middle would otherwise leave a hole — positions 0,2,3
    // — and every later insert computes its position from the count, so the
    // hole eventually collides. Renumbering keeps them contiguous from 0.
    await runBatch(db, [
      db.delete(programDays).where(eq(programDays.id, day.id)),
      ...remaining.map((d, position) =>
        db.update(programDays).set({ position }).where(eq(programDays.id, d.id)),
      ),
    ]);

    return c.body(null, 204);
  })

  .get("/:id", async (c) => {
    const db = drizzle(c.env.DB);
    const program = await findOwnedProgram(db, c.get("session").user.id, c.req.param("id"));
    if (!program) return c.json(fail("not_found", "no such program"), 404);

    const days = await db
      .select()
      .from(programDays)
      .where(eq(programDays.programId, program.id))
      .orderBy(asc(programDays.position));

    return c.json(
      programDetailSchema.parse({
        id: program.id,
        name: program.name,
        notes: program.notes,
        isActive: program.isActive === 1,
        archivedAt: program.archivedAt,
        createdAt: program.createdAt,
        days: days.map((d) => ({
          id: d.id,
          name: d.name,
          position: d.position,
          exercises: [],
        })),
      }),
    );
  })

  .post("/:id/days", async (c) => {
    const parsed = createDaySchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json(fail("bad_request", "invalid day"), 400);

    const db = drizzle(c.env.DB);
    const program = await findOwnedProgram(db, c.get("session").user.id, c.req.param("id"));
    if (!program) return c.json(fail("not_found", "no such program"), 404);

    const [existing] = await db
      .select({ n: count() })
      .from(programDays)
      .where(eq(programDays.programId, program.id));

    const id = newId();
    await db.insert(programDays).values({
      id,
      programId: program.id,
      // A new day lands at the end. Positions are kept contiguous by the
      // delete and reorder handlers, so the count is the next free slot.
      position: existing?.n ?? 0,
      name: parsed.data.name,
    });

    return c.json({ id }, 201);
  })

  .put("/:id/days/order", async (c) => {
    const parsed = reorderSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json(fail("bad_request", "invalid order"), 400);

    const db = drizzle(c.env.DB);
    const program = await findOwnedProgram(db, c.get("session").user.id, c.req.param("id"));
    if (!program) return c.json(fail("not_found", "no such program"), 404);

    const existing = await db
      .select({ id: programDays.id })
      .from(programDays)
      .where(eq(programDays.programId, program.id));

    /**
     * The submitted list must be exactly this program's day ids — same
     * members, no duplicates, none missing. Anything else is refused before a
     * single row is touched, because a partial reorder leaves two days sharing
     * a position and the resulting order is then arbitrary. D1 gives no
     * interactive transaction to roll back inside, so checking set equality up
     * front is the only way to be certain.
     */
    const submitted = parsed.data.ids;
    const known = new Set(existing.map((d) => d.id));
    const unique = new Set(submitted);
    const complete =
      unique.size === submitted.length &&
      unique.size === known.size &&
      submitted.every((id) => known.has(id));
    if (!complete) return c.json(fail("bad_request", "order must list every day exactly once"), 400);

    await runBatch(
      db,
      submitted.map((id, position) =>
        db.update(programDays).set({ position }).where(eq(programDays.id, id)),
      ),
    );

    return c.body(null, 204);
  });
