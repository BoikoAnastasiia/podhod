import type { ProgramDetail } from "@podhod/schema";
import { beforeAll, describe, expect, it } from "vitest";
import { api, setUpSchema, signUpAs } from "./programHelpers.js";

let client: ReturnType<typeof api>;

beforeAll(async () => {
  await setUpSchema();
  client = api(await signUpAs("days@example.com"));
});

const newProgram = async (name: string): Promise<string> => {
  const res = await client.post("/api/programs", { name });
  return (await client.json<{ id: string }>(res)).id;
};

const addDay = async (programId: string, name: string): Promise<string> => {
  const res = await client.post(`/api/programs/${programId}/days`, { name });
  expect(res.status).toBe(201);
  return (await client.json<{ id: string }>(res)).id;
};

const detail = async (programId: string): Promise<ProgramDetail> =>
  client.json<ProgramDetail>(await client.get(`/api/programs/${programId}`));

const positions = async (programId: string) =>
  (await detail(programId)).days.map((d) => ({ name: d.name, position: d.position }));

describe("program days", () => {
  it("appends each new day at the end", async () => {
    const p = await newProgram("append");
    await addDay(p, "Push");
    await addDay(p, "Pull");
    await addDay(p, "Legs");

    expect(await positions(p)).toEqual([
      { name: "Push", position: 0 },
      { name: "Pull", position: 1 },
      { name: "Legs", position: 2 },
    ]);
  });

  it("renames a day", async () => {
    const p = await newProgram("rename");
    const d = await addDay(p, "Day A");
    expect((await client.patch(`/api/programs/days/${d}`, { name: "Upper" })).status).toBe(204);
    expect((await detail(p)).days[0]?.name).toBe("Upper");
  });

  it("rejects a day with a blank name", async () => {
    const p = await newProgram("blank");
    expect((await client.post(`/api/programs/${p}/days`, { name: "   " })).status).toBe(400);
  });

  it("404s when adding a day to a program that does not exist", async () => {
    expect((await client.post("/api/programs/nope/days", { name: "x" })).status).toBe(404);
  });

  it("404s on a day that does not exist", async () => {
    expect((await client.patch("/api/programs/days/nope", { name: "x" })).status).toBe(404);
    expect((await client.delete("/api/programs/days/nope")).status).toBe(404);
  });

  /**
   * Positions must stay contiguous from zero. A new day takes its position
   * from the existing count, so a hole left by a delete eventually collides —
   * two days at the same position, and the order between them is then whatever
   * SQLite feels like.
   */
  it("closes the gap when a day is deleted from the middle", async () => {
    const p = await newProgram("gap");
    await addDay(p, "A");
    const b = await addDay(p, "B");
    await addDay(p, "C");

    expect((await client.delete(`/api/programs/days/${b}`)).status).toBe(204);

    expect(await positions(p)).toEqual([
      { name: "A", position: 0 },
      { name: "C", position: 1 },
    ]);
  });

  it("gives a day added after a delete the next free position", async () => {
    const p = await newProgram("reuse");
    const a = await addDay(p, "A");
    await addDay(p, "B");
    await client.delete(`/api/programs/days/${a}`);
    await addDay(p, "C");

    expect(await positions(p)).toEqual([
      { name: "B", position: 0 },
      { name: "C", position: 1 },
    ]);
  });
});

describe("reordering days", () => {
  it("rewrites every position to match the submitted order", async () => {
    const p = await newProgram("reorder");
    const a = await addDay(p, "A");
    const b = await addDay(p, "B");
    const c = await addDay(p, "C");

    expect((await client.put(`/api/programs/${p}/days/order`, { ids: [c, a, b] })).status).toBe(
      204,
    );

    expect(await positions(p)).toEqual([
      { name: "C", position: 0 },
      { name: "A", position: 1 },
      { name: "B", position: 2 },
    ]);
  });

  /**
   * A partial reorder would leave two days sharing a position, permanently —
   * D1 has no interactive transaction to roll back inside. So the whole set is
   * checked before anything is written, and these cases assert nothing moved.
   */
  it("rejects an order that omits a day, changing nothing", async () => {
    const p = await newProgram("omit");
    const a = await addDay(p, "A");
    await addDay(p, "B");
    const before = await positions(p);

    expect((await client.put(`/api/programs/${p}/days/order`, { ids: [a] })).status).toBe(400);
    expect(await positions(p)).toEqual(before);
  });

  it("rejects an order naming a day from another program, changing nothing", async () => {
    const p = await newProgram("foreign");
    const a = await addDay(p, "A");
    const other = await newProgram("elsewhere");
    const stranger = await addDay(other, "Stranger");
    const before = await positions(p);

    const res = await client.put(`/api/programs/${p}/days/order`, { ids: [a, stranger] });
    expect(res.status).toBe(400);
    expect(await positions(p)).toEqual(before);
    // And the other program is untouched too.
    expect((await positions(other))[0]).toEqual({ name: "Stranger", position: 0 });
  });

  it("rejects an order listing the same day twice, changing nothing", async () => {
    const p = await newProgram("dupe");
    const a = await addDay(p, "A");
    await addDay(p, "B");
    const before = await positions(p);

    // Same length as the real set, so only a duplicate check catches it.
    expect((await client.put(`/api/programs/${p}/days/order`, { ids: [a, a] })).status).toBe(400);
    expect(await positions(p)).toEqual(before);
  });

  it("rejects an empty order", async () => {
    const p = await newProgram("empty-order");
    await addDay(p, "A");
    expect((await client.put(`/api/programs/${p}/days/order`, { ids: [] })).status).toBe(400);
  });
});
