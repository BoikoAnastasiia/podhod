/**
 * Every migration drizzle-kit has generated, eagerly inlined as text by Vite.
 * Globbing rather than naming one file keeps the suite honest when a second
 * migration lands — a hardcoded import would silently run the tests against a
 * stale schema.
 */
const migrations = import.meta.glob("../migrations/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
});

/**
 * drizzle-kit separates statements with `--> statement-breakpoint`. D1's exec
 * takes one statement at a time, so we split and run them in order, migration
 * by migration. Glob key order is unspecified, so the numeric filename prefix
 * is applied as an explicit sort.
 */
export async function applyMigrations(db: D1Database): Promise<void> {
  const files = Object.entries(migrations).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  if (files.length === 0) {
    throw new Error(
      "applyMigrations matched no .sql files under apps/api/migrations. " +
        "Run `pnpm --filter @podhod/api run db:generate` first.",
    );
  }
  for (const [, migration] of files) {
    const statements = migration
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const sql of statements) await db.exec(sql.replace(/\n/g, " "));
  }
}
