import { and, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { programExercises, programs } from "../db/schema.js";

/**
 * Every id that arrives in a request is attacker-controlled, including the ones
 * that look internal — an entry id is as much user input as `name` is. These
 * helpers are the only sanctioned way to turn one into a row: each joins back
 * to `programs` and filters on the session's own user id, so a row belonging to
 * somebody else is simply not found.
 *
 * Callers turn `undefined` into a **404, not a 403**. A 403 confirms the id
 * exists and belongs to someone, which is an enumeration oracle; 404 tells an
 * attacker nothing they did not already know.
 *
 * The alternative — denormalizing `user_id` onto every table — was rejected.
 * docs/design.md accepts exactly one denormalization, on `set_logs`, where the
 * hottest query in the app justifies it. Here the join is two levels at most
 * and runs on indexed primary keys.
 */
export async function findOwnedProgram(
  db: DrizzleD1Database,
  userId: string,
  programId: string,
) {
  const [row] = await db
    .select()
    .from(programs)
    .where(and(eq(programs.id, programId), eq(programs.userId, userId)))
    .limit(1);
  return row;
}

export async function findOwnedProgramExercise(
  db: DrizzleD1Database,
  userId: string,
  entryId: string,
) {
  const [row] = await db
    .select({ entry: programExercises })
    .from(programExercises)
    .innerJoin(programs, eq(programExercises.programId, programs.id))
    .where(and(eq(programExercises.id, entryId), eq(programs.userId, userId)))
    .limit(1);
  return row?.entry;
}
