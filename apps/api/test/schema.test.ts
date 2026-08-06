import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { applyMigrations } from "./helpers.js";

beforeAll(async () => {
  await applyMigrations(env.DB);
});

describe("schema", () => {
  it("creates both library tables", async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    ).all<{ name: string }>();
    const names = results.map((r) => r.name);
    expect(names).toContain("exercises");
    expect(names).toContain("exercise_translations");
  });

  /**
   * `applyMigrations` globs every file under apps/api/migrations and applies
   * them in numeric order (see test/helpers.ts) — this is the check that a
   * second migration file (0001, adding Better Auth's tables plus
   * user_settings) actually gets picked up rather than silently skipped.
   * Every table here comes from 0001; none exist in 0000.
   */
  it("also applies the second migration, creating the auth and user_settings tables", async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    ).all<{ name: string }>();
    const names = results.map((r) => r.name);
    expect(names).toContain("user");
    expect(names).toContain("session");
    expect(names).toContain("account");
    expect(names).toContain("verification");
    expect(names).toContain("user_settings");
  });

  it("enforces the composite primary key on translations", async () => {
    await env.DB.prepare(
      "INSERT INTO exercises (id, body_part, equipment, target, muscle_group, secondary_muscles, media_id, image_path, gif_path) VALUES ('0001','waist','body weight','abs','hip flexors','[]','x','i.jpg','g.gif')",
    ).run();
    const insert =
      "INSERT INTO exercise_translations (exercise_id, lang, name, steps, search_text) VALUES ('0001','en','sit-up','[]','sit-up')";
    await env.DB.prepare(insert).run();
    await expect(env.DB.prepare(insert).run()).rejects.toThrow();
  });
});
