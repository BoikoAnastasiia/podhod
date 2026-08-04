import { applyD1Migrations, env, type D1Migration } from "cloudflare:test";

/**
 * Applies every generated migration, in numeric filename order.
 *
 * The list is read from disk in `vitest.config.ts` and injected as the
 * `TEST_MIGRATIONS` binding, because the Worker has no filesystem. Splitting
 * and applying are left to `readD1Migrations`/`applyD1Migrations`: the former
 * uses wrangler's SQL-aware splitter, the latter runs each statement through
 * `prepare`. Splitting by hand on `--> statement-breakpoint` and flattening
 * newlines for `exec` looks equivalent, but silently truncates any statement
 * containing a `-- comment` — and third-party migrations do contain them.
 *
 * `migrations` is overridable only so the fixture suite can drive this function
 * with migrations of its own. Callers pass just the database.
 */
export async function applyMigrations(
  db: D1Database,
  migrations: D1Migration[] = env.TEST_MIGRATIONS,
): Promise<void> {
  if (migrations.length === 0) {
    throw new Error(
      "applyMigrations was given no migrations. If apps/api/migrations is empty, " +
        "run `pnpm --filter @podhod/api run db:generate` first.",
    );
  }
  await applyD1Migrations(db, migrations);
}
