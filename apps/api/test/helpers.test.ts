import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { applyMigrations } from "./helpers.js";

/**
 * Exercises applyMigrations against fixture migrations under
 * test/fixtures/migrations, so the properties that matter — every file applied,
 * applied in order, comments left to the SQL parser — are asserted without
 * putting throwaway tables in the real schema.
 */
describe("applyMigrations", () => {
  beforeAll(async () => {
    await applyMigrations(env.DB, env.TEST_FIXTURE_MIGRATIONS);
  });

  it("keeps a statement whole when a line comment sits in the middle of it", async () => {
    const { results } = await env.DB.prepare(
      "PRAGMA table_info(`commented`)",
    ).all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual(["id", "kept"]);
  });

  it("applies later migrations after earlier ones", async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' ORDER BY name",
    ).all<{ name: string }>();
    // idx_needs_0000 comes from 0001 and indexes a table created by 0000.
    expect(results.map((r) => r.name)).toContain("idx_needs_0000");
    expect(results.map((r) => r.name)).toContain("idx_commented_kept");
  });

  it("refuses an empty migration list rather than leaving an empty database", async () => {
    await expect(applyMigrations(env.DB, [])).rejects.toThrow(
      /was given no migrations/,
    );
  });
});
