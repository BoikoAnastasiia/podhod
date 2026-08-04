import migration from "../migrations/0000_even_marauders.sql?raw";

/**
 * drizzle-kit separates statements with `--> statement-breakpoint`. D1's exec
 * takes one statement at a time, so we split and run them in order.
 * Rename the import above if drizzle-kit names the file differently.
 */
export async function applyMigrations(db: D1Database): Promise<void> {
  const statements = migration
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const sql of statements) await db.exec(sql.replace(/\n/g, " "));
}
