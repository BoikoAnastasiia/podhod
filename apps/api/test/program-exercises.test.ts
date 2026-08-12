import type { ProgramDetail, ProgramExercise } from "@podhod/schema";
import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { ALL_SCHEMES, api, DOUBLE, LINEAR, RPE, setUpSchema, signUpAs } from "./programHelpers.js";

let client: ReturnType<typeof api>;

beforeAll(async () => {
  await setUpSchema(["e1", "e2", "e3"]);
  client = api(await signUpAs("entries@example.com"));
});

const newProgram = async (name: string): Promise<string> => {
  const p = await client.json<{ id: string }>(await client.post("/api/programs", { name }));
  return p.id;
};

const add = async (programId: string, body: Record<string, unknown>): Promise<Response> =>
  client.post(`/api/programs/${programId}/exercises`, body);

const addOk = async (programId: string, body: Record<string, unknown>): Promise<string> => {
  const res = await add(programId, body);
  expect(res.status).toBe(201);
  return (await client.json<{ id: string }>(res)).id;
};

const entriesOf = async (programId: string, lang = "en"): Promise<ProgramExercise[]> => {
  const detail = await client.json<ProgramDetail>(
    await client.get(`/api/programs/${programId}?lang=${lang}`),
  );
  return detail.exercises;
};

describe("exercises within a program", () => {
  it("stores an exercise and returns it with its scheme intact", async () => {
    const programId = await newProgram("store");
    await addOk(programId, { exerciseId: "e1", scheme: LINEAR, restSeconds: 90 });

    const [entry] = await entriesOf(programId);
    expect(entry).toMatchObject({
      exerciseId: "e1",
      position: 0,
      scheme: LINEAR,
      restSeconds: 90,
      notes: null,
    });
  });

  /**
   * Every scheme must survive JSON storage byte-for-byte. A scheme that comes
   * back subtly different — a dropped optional, a stringified number — feeds
   * nextTarget() wrong input and the error surfaces as a wrong weight, not as
   * a crash.
   */
  it.each(ALL_SCHEMES)("round-trips a $kind scheme through storage unchanged", async (scheme) => {
    const programId = await newProgram(`roundtrip-${scheme.kind}`);
    await addOk(programId, { exerciseId: "e1", scheme });

    const [entry] = await entriesOf(programId);
    expect(entry?.scheme).toEqual(scheme);
  });

  it("joins the name and image from the library rather than storing copies", async () => {
    const programId = await newProgram("join");
    await addOk(programId, { exerciseId: "e2", scheme: LINEAR });

    const [entry] = await entriesOf(programId);
    expect(entry).toMatchObject({ name: "exercise e2", imagePath: "images/e2.jpg" });
  });

  it("returns the name in the requested language", async () => {
    const programId = await newProgram("lang");
    await addOk(programId, { exerciseId: "e1", scheme: LINEAR });

    expect((await entriesOf(programId, "ru"))[0]?.name).toBe("упражнение e1");
  });

  /**
   * This rule reverses an earlier one. The same exercise twice in a workout —
   * heavy then light, two different schemes — is a real training pattern, and
   * the API used to allow it for that reason. It is forbidden now because
   * accidental duplicates turned out to be the far more common case: nothing
   * confirmed the first tap in the picker, so people tapped again and got two
   * identical rows (the owner's call, 2026-08-12, from exactly that).
   *
   * The picker also marks what a program already holds, so the duplicate is
   * refused before it is attempted; this is the backstop.
   */
  it("refuses the same exercise twice in one workout", async () => {
    const programId = await newProgram("twice");
    await addOk(programId, { exerciseId: "e1", scheme: LINEAR });

    const res = await add(programId, { exerciseId: "e1", scheme: DOUBLE });
    expect(res.status).toBe(409);

    const entries = await entriesOf(programId);
    expect(entries).toHaveLength(1);
    expect(entries.map((e) => e.position)).toEqual([0]);
  });

  it("rejects a malformed scheme and stores nothing", async () => {
    const programId = await newProgram("bad-scheme");
    const res = await add(programId, { exerciseId: "e1", scheme: { kind: "linear", sets: 3 } });

    expect(res.status).toBe(400);
    expect(await entriesOf(programId)).toHaveLength(0);
  });

  it("rejects an exercise that is not in the library, rather than failing on the foreign key", async () => {
    const programId = await newProgram("ghost");
    const res = await add(programId, { exerciseId: "not-a-real-exercise", scheme: LINEAR });
    // A foreign-key violation would surface as a 500; this is the caller's
    // mistake and belongs in the 4xx range.
    expect(res.status).toBe(400);
  });

  it("404s when adding to a program that does not exist", async () => {
    expect((await add("nope", { exerciseId: "e1", scheme: LINEAR })).status).toBe(404);
  });
});

describe("editing an exercise entry", () => {
  it("keeps scheme_type in step with the JSON when the scheme is replaced", async () => {
    const programId = await newProgram("scheme-swap");
    const entryId = await addOk(programId, { exerciseId: "e1", scheme: LINEAR });

    expect((await client.patch(`/api/programs/exercises/${entryId}`, { scheme: RPE })).status).toBe(
      204,
    );

    // Two sources for one fact drift; this asserts they do not. Read straight
    // from the column, since the API response only exposes the JSON.
    const row = await env.DB.prepare(
      "SELECT scheme_type, scheme_config FROM program_exercises WHERE id = ?",
    )
      .bind(entryId)
      .first<{ scheme_type: string; scheme_config: string }>();
    expect(row?.scheme_type).toBe("rpe");
    expect(JSON.parse(row?.scheme_config ?? "{}")).toEqual(RPE);
  });

  it("changes rest without touching the scheme", async () => {
    const programId = await newProgram("rest");
    const entryId = await addOk(programId, { exerciseId: "e1", scheme: LINEAR, restSeconds: 90 });

    await client.patch(`/api/programs/exercises/${entryId}`, { restSeconds: 120 });

    const [entry] = await entriesOf(programId);
    expect(entry).toMatchObject({ restSeconds: 120, scheme: LINEAR });
  });

  it("clears rest back to the user's default with an explicit null", async () => {
    const programId = await newProgram("clear-rest");
    const entryId = await addOk(programId, { exerciseId: "e1", scheme: LINEAR, restSeconds: 90 });

    await client.patch(`/api/programs/exercises/${entryId}`, { restSeconds: null });

    expect((await entriesOf(programId))[0]?.restSeconds).toBeNull();
  });

  it("404s on an entry that does not exist", async () => {
    expect((await client.patch("/api/programs/exercises/nope", { notes: "x" })).status).toBe(404);
    expect((await client.delete("/api/programs/exercises/nope")).status).toBe(404);
  });
});

describe("removing and reordering exercises", () => {
  it("closes the gap when an exercise is deleted from the middle", async () => {
    const programId = await newProgram("gap");
    await addOk(programId, { exerciseId: "e1", scheme: LINEAR });
    const b = await addOk(programId, { exerciseId: "e2", scheme: LINEAR });
    await addOk(programId, { exerciseId: "e3", scheme: LINEAR });

    expect((await client.delete(`/api/programs/exercises/${b}`)).status).toBe(204);

    const entries = await entriesOf(programId);
    expect(entries.map((e) => [e.exerciseId, e.position])).toEqual([
      ["e1", 0],
      ["e3", 1],
    ]);
  });

  it("rewrites every position to match the submitted order", async () => {
    const programId = await newProgram("reorder");
    const a = await addOk(programId, { exerciseId: "e1", scheme: LINEAR });
    const b = await addOk(programId, { exerciseId: "e2", scheme: LINEAR });
    const cc = await addOk(programId, { exerciseId: "e3", scheme: LINEAR });

    expect(
      (await client.put(`/api/programs/${programId}/exercises/order`, { ids: [cc, a, b] })).status,
    ).toBe(204);

    expect((await entriesOf(programId)).map((e) => e.exerciseId)).toEqual(["e3", "e1", "e2"]);
  });

  it("rejects a partial order, changing nothing", async () => {
    const programId = await newProgram("partial");
    const a = await addOk(programId, { exerciseId: "e1", scheme: LINEAR });
    await addOk(programId, { exerciseId: "e2", scheme: LINEAR });
    const before = await entriesOf(programId);

    expect(
      (await client.put(`/api/programs/${programId}/exercises/order`, { ids: [a] })).status,
    ).toBe(400);
    expect(await entriesOf(programId)).toEqual(before);
  });

  it("rejects an order listing the same entry twice, changing nothing", async () => {
    const programId = await newProgram("dupe");
    const a = await addOk(programId, { exerciseId: "e1", scheme: LINEAR });
    await addOk(programId, { exerciseId: "e2", scheme: LINEAR });
    const before = await entriesOf(programId);

    expect(
      (await client.put(`/api/programs/${programId}/exercises/order`, { ids: [a, a] })).status,
    ).toBe(400);
    expect(await entriesOf(programId)).toEqual(before);
  });
});
