import type { ProgramListResponse, ProgramSummary } from "@podhod/schema";
import { beforeAll, describe, expect, it } from "vitest";
import { api, setUpSchema, signUpAs } from "./programHelpers.js";

let client: ReturnType<typeof api>;

beforeAll(async () => {
  await setUpSchema();
  client = api(await signUpAs("crud@example.com"));
});

const create = async (name: string): Promise<string> => {
  const res = await client.post("/api/programs", { name });
  expect(res.status).toBe(201);
  const { id } = await client.json<{ id: string }>(res);
  return id;
};

const list = async (): Promise<ProgramSummary[]> => {
  const res = await client.get("/api/programs");
  const body = await client.json<ProgramListResponse>(res);
  return body.programs;
};

const find = async (id: string): Promise<ProgramSummary> => {
  const found = (await list()).find((p) => p.id === id);
  if (!found) throw new Error(`program ${id} not in list`);
  return found;
};

describe("program CRUD", () => {
  it("creates a program and returns it in the list", async () => {
    const id = await create("5×5");
    const program = await find(id);
    expect(program).toMatchObject({ name: "5×5", isActive: false, archivedAt: null });
  });

  it("reports an exercise count of zero for a program with no exercises", async () => {
    // A LEFT JOIN with COUNT over a missing child famously returns 1 when the
    // count is taken over the joined table's *row* rather than a column.
    const id = await create("empty");
    expect((await find(id)).exerciseCount).toBe(0);
  });

  it("rejects a program with no name", async () => {
    const res = await client.post("/api/programs", { name: "  " });
    expect(res.status).toBe(400);
  });

  it("rejects a body that is not JSON at all", async () => {
    const res = await client.post("/api/programs");
    expect(res.status).toBe(400);
  });

  it("stores, changes and clears an icon", async () => {
    const res = await client.post("/api/programs", { name: "iconed", icon: "quads" });
    expect(res.status).toBe(201);
    const { id } = await client.json<{ id: string }>(res);
    expect((await find(id)).icon).toBe("quads");

    expect((await client.patch(`/api/programs/${id}`, { icon: "biceps" })).status).toBe(204);
    expect((await find(id)).icon).toBe("biceps");

    // null clears rather than being ignored — "no icon" is a state someone
    // chooses, not the absence of a choice.
    expect((await client.patch(`/api/programs/${id}`, { icon: null })).status).toBe(204);
    expect((await find(id)).icon).toBeNull();
  });

  /**
   * The icon column stopped being free text in migration 0005. An unknown name
   * renders as nothing at all, so rejecting it at the API is the only place the
   * mistake is visible.
   */
  it("rejects an icon that is not one of the sprite's glyphs", async () => {
    const res = await client.post("/api/programs", { name: "bad icon", icon: "🦵" });
    expect(res.status).toBe(400);
  });

  it("stores a preset colour key and a custom hex, and rejects anything else", async () => {
    const id = await create("coloured");
    expect((await client.patch(`/api/programs/${id}`, { iconColor: "lime" })).status).toBe(204);
    expect((await find(id)).iconColor).toBe("lime");

    expect((await client.patch(`/api/programs/${id}`, { iconColor: "#3d8bff" })).status).toBe(204);
    expect((await find(id)).iconColor).toBe("#3d8bff");

    expect((await client.patch(`/api/programs/${id}`, { iconColor: "rebeccapurple" })).status).toBe(
      400,
    );
  });

  it("defaults the icon and its colour to null when a create does not send them", async () => {
    const id = await create("plain");
    expect((await find(id)).icon).toBeNull();
    expect((await find(id)).iconColor).toBeNull();
  });

  it("renames a program", async () => {
    const id = await create("old name");
    expect((await client.patch(`/api/programs/${id}`, { name: "new name" })).status).toBe(204);
    expect((await find(id)).name).toBe("new name");
  });

  it("treats an empty patch as a no-op rather than an error", async () => {
    const id = await create("untouched");
    expect((await client.patch(`/api/programs/${id}`, {})).status).toBe(204);
    expect((await find(id)).name).toBe("untouched");
  });

  it("404s on a program that does not exist", async () => {
    expect((await client.patch("/api/programs/nope", { name: "x" })).status).toBe(404);
    expect((await client.delete("/api/programs/nope")).status).toBe(404);
  });

  it("deletes a program", async () => {
    const id = await create("doomed");
    expect((await client.delete(`/api/programs/${id}`)).status).toBe(204);
    expect((await list()).find((p) => p.id === id)).toBeUndefined();
  });
});

describe("activation", () => {
  it("activating a program deactivates the one that was active", async () => {
    const a = await create("A");
    const b = await create("B");

    await client.patch(`/api/programs/${a.toString()}`, { isActive: true });
    expect((await find(a)).isActive).toBe(true);

    // The interesting write: the partial unique index means this can only
    // succeed if A is cleared in the same batch, not after.
    expect((await client.patch(`/api/programs/${b}`, { isActive: true })).status).toBe(204);
    expect((await find(a)).isActive).toBe(false);
    expect((await find(b)).isActive).toBe(true);
  });

  it("activating the already-active program is idempotent", async () => {
    const id = await create("steady");
    await client.patch(`/api/programs/${id}`, { isActive: true });
    expect((await client.patch(`/api/programs/${id}`, { isActive: true })).status).toBe(204);
    expect((await find(id)).isActive).toBe(true);
  });

  it("deactivating leaves nothing active", async () => {
    const id = await create("off");
    await client.patch(`/api/programs/${id}`, { isActive: true });
    await client.patch(`/api/programs/${id}`, { isActive: false });
    expect((await list()).every((p) => !p.isActive)).toBe(true);
  });

  /**
   * An archived program still flagged active would hold the one-active slot
   * enforced by the partial unique index, and silently block activating
   * anything else — with no visible cause, since the offending program is
   * filed away out of sight.
   */
  it("archiving the active program also clears its active flag", async () => {
    const id = await create("retired");
    await client.patch(`/api/programs/${id}`, { isActive: true });
    await client.patch(`/api/programs/${id}`, { archived: true });

    const program = await find(id);
    expect(program.isActive).toBe(false);
    expect(program.archivedAt).toBeTypeOf("number");

    // The slot is genuinely free: something else can now be activated.
    const next = await create("successor");
    expect((await client.patch(`/api/programs/${next}`, { isActive: true })).status).toBe(204);
  });

  it("un-archives a program", async () => {
    const id = await create("returning");
    await client.patch(`/api/programs/${id}`, { archived: true });
    await client.patch(`/api/programs/${id}`, { archived: false });
    expect((await find(id)).archivedAt).toBeNull();
  });
});
