import type { ExerciseDetail, ListResponse } from "@podhod/schema";
import { env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { applyMigrations } from "./helpers.js";

// Response.json() is typed as Promise<unknown> in @cloudflare/workers-types,
// so callers pin the shape with the generic. This mirrors what a real API
// consumer would do against the same exported schema types.
type ErrorBody = { error: { code: string; message: string } };

const insert = async (
  id: string,
  bodyPart: string,
  equipment: string,
  target: string,
  en: string,
  ru: string,
) => {
  await env.DB.prepare(
    "INSERT INTO exercises (id, body_part, equipment, target, muscle_group, secondary_muscles, media_id, image_path, gif_path) VALUES (?,?,?,?,'grp','[]','m','i.jpg','g.gif')",
  ).bind(id, bodyPart, equipment, target).run();
  await env.DB.prepare(
    "INSERT INTO exercise_translations (exercise_id, lang, name, steps, search_text) VALUES (?,'en',?,'[\"a\"]',?)",
  ).bind(id, en, `${en} ${target} ${equipment}`.toLowerCase()).run();
  await env.DB.prepare(
    "INSERT INTO exercise_translations (exercise_id, lang, name, steps, search_text) VALUES (?,'ru',?,'[\"б\"]',?)",
  ).bind(id, ru, `${ru} ${target} ${equipment}`.toLowerCase()).run();
};

beforeAll(async () => {
  await applyMigrations(env.DB);
  await insert("0001", "chest", "barbell", "pectorals", "bench press", "жим лёжа");
  await insert("0002", "back", "cable", "lats", "cable row", "тяга блока");
  await insert("0003", "chest", "dumbbell", "pectorals", "dumbbell fly", "разводка");
});

describe("GET /api/exercises", () => {
  it("returns items in English by default", async () => {
    const res = await SELF.fetch("https://x/api/exercises");
    expect(res.status).toBe(200);
    const body = await res.json<ListResponse>();
    expect(body.items).toHaveLength(3);
    expect(body.items.map((i) => i.name)).toContain("bench press");
  });

  it("returns Russian names when lang=ru", async () => {
    const res = await SELF.fetch("https://x/api/exercises?lang=ru");
    const body = await res.json<ListResponse>();
    expect(body.items.map((i) => i.name)).toContain("жим лёжа");
  });

  it("filters by body part", async () => {
    const res = await SELF.fetch("https://x/api/exercises?bodyPart=chest");
    const body = await res.json<ListResponse>();
    expect(body.items).toHaveLength(2);
  });

  it("searches by substring, case-insensitively", async () => {
    const res = await SELF.fetch("https://x/api/exercises?q=BENCH");
    const body = await res.json<ListResponse>();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.id).toBe("0001");
  });

  it("searches Cyrillic when lang=ru", async () => {
    const res = await SELF.fetch("https://x/api/exercises?lang=ru&q=тяга");
    const body = await res.json<ListResponse>();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.id).toBe("0002");
  });

  it("paginates with a cursor", async () => {
    const first = await (
      await SELF.fetch("https://x/api/exercises?limit=2")
    ).json<ListResponse>();
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toBe("0002");
    const second = await (
      await SELF.fetch("https://x/api/exercises?limit=2&cursor=0002")
    ).json<ListResponse>();
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
  });

  it("rejects an invalid lang with 400", async () => {
    const res = await SELF.fetch("https://x/api/exercises?lang=de");
    expect(res.status).toBe(400);
    expect((await res.json<ErrorBody>()).error.code).toBe("bad_request");
  });
});

describe("GET /api/exercises/:id", () => {
  it("returns the detail record with steps", async () => {
    const res = await SELF.fetch("https://x/api/exercises/0001?lang=ru");
    expect(res.status).toBe(200);
    const body = await res.json<ExerciseDetail>();
    expect(body.name).toBe("жим лёжа");
    expect(body.steps).toEqual(["б"]);
    expect(body.gifPath).toBe("g.gif");
  });

  it("returns 404 for an unknown id", async () => {
    const res = await SELF.fetch("https://x/api/exercises/9999");
    expect(res.status).toBe(404);
    expect((await res.json<ErrorBody>()).error.code).toBe("not_found");
  });
});
