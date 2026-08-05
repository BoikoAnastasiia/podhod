import {
  countResponseSchema,
  detailSchema,
  errorResponseSchema,
  listResponseSchema,
} from "@podhod/schema";
import { env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { applyMigrations } from "./helpers.js";

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
    const body = listResponseSchema.parse(await res.json());
    expect(body.items).toHaveLength(3);
    expect(body.items.map((i) => i.name)).toContain("bench press");
  });

  it("returns Russian names when lang=ru", async () => {
    const res = await SELF.fetch("https://x/api/exercises?lang=ru");
    const body = listResponseSchema.parse(await res.json());
    expect(body.items.map((i) => i.name)).toContain("жим лёжа");
  });

  it("filters by body part", async () => {
    const res = await SELF.fetch("https://x/api/exercises?bodyPart=chest");
    const body = listResponseSchema.parse(await res.json());
    expect(body.items).toHaveLength(2);
  });

  it("searches by substring, case-insensitively", async () => {
    const res = await SELF.fetch("https://x/api/exercises?q=BENCH");
    const body = listResponseSchema.parse(await res.json());
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.id).toBe("0001");
  });

  it("searches Cyrillic when lang=ru", async () => {
    const res = await SELF.fetch("https://x/api/exercises?lang=ru&q=тяга");
    const body = listResponseSchema.parse(await res.json());
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.id).toBe("0002");
  });

  it("treats a literal percent in the query as a literal character, not a wildcard", async () => {
    const res = await SELF.fetch("https://x/api/exercises?q=%25");
    const body = listResponseSchema.parse(await res.json());
    expect(body.items).toHaveLength(0);
  });

  it("treats a literal underscore in the query as a literal character, not a wildcard", async () => {
    // Unescaped, "pr_ss" would match "press" via the underscore wildcard.
    const res = await SELF.fetch("https://x/api/exercises?q=pr_ss");
    const body = listResponseSchema.parse(await res.json());
    expect(body.items).toHaveLength(0);
  });

  it("paginates with a cursor", async () => {
    const first = listResponseSchema.parse(
      await (await SELF.fetch("https://x/api/exercises?limit=2")).json(),
    );
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toBe("0002");
    const second = listResponseSchema.parse(
      await (await SELF.fetch("https://x/api/exercises?limit=2&cursor=0002")).json(),
    );
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
  });

  it("returns no next cursor when the page lands exactly on the total", async () => {
    const res = await SELF.fetch("https://x/api/exercises?limit=3");
    const body = listResponseSchema.parse(await res.json());
    expect(body.items).toHaveLength(3);
    expect(body.nextCursor).toBeNull();
  });

  it("returns an empty page for a cursor past the end", async () => {
    const res = await SELF.fetch("https://x/api/exercises?cursor=0003");
    const body = listResponseSchema.parse(await res.json());
    expect(body.items).toHaveLength(0);
    expect(body.nextCursor).toBeNull();
  });

  it("treats an empty lang or limit as absent, defaulting instead of failing", async () => {
    const res = await SELF.fetch("https://x/api/exercises?lang=&limit=");
    expect(res.status).toBe(200);
    const body = listResponseSchema.parse(await res.json());
    expect(body.items).toHaveLength(3);
    expect(body.items.map((i) => i.name)).toContain("bench press");
  });

  it("rejects an invalid lang with 400", async () => {
    const res = await SELF.fetch("https://x/api/exercises?lang=de");
    expect(res.status).toBe(400);
    const body = errorResponseSchema.parse(await res.json());
    expect(body.error.code).toBe("bad_request");
  });
});

describe("GET /api/exercises/count", () => {
  it("counts every exercise regardless of language, unfiltered by the list route's params", async () => {
    const res = await SELF.fetch("https://x/api/exercises/count");
    expect(res.status).toBe(200);
    const body = countResponseSchema.parse(await res.json());
    expect(body.total).toBe(3);
  });
});

describe("GET /api/exercises/:id", () => {
  it("returns the detail record with steps", async () => {
    const res = await SELF.fetch("https://x/api/exercises/0001?lang=ru");
    expect(res.status).toBe(200);
    const body = detailSchema.parse(await res.json());
    expect(body.name).toBe("жим лёжа");
    expect(body.steps).toEqual(["б"]);
    expect(body.gifPath).toBe("g.gif");
  });

  it("returns 404 for an unknown id", async () => {
    const res = await SELF.fetch("https://x/api/exercises/9999");
    expect(res.status).toBe(404);
    const body = errorResponseSchema.parse(await res.json());
    expect(body.error.code).toBe("not_found");
  });

  it("rejects an invalid lang with 400, same as the list route", async () => {
    const res = await SELF.fetch("https://x/api/exercises/0001?lang=de");
    expect(res.status).toBe(400);
    const body = errorResponseSchema.parse(await res.json());
    expect(body.error.code).toBe("bad_request");
  });
});
