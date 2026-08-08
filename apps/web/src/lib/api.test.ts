import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createProgram,
  deleteDay,
  deleteExercise,
  deleteProgram,
  fetchExercise,
  fetchExerciseCount,
  fetchExercises,
  fetchProgram,
  reorderDays,
  reorderExercises,
  updateExercise,
  updateProgram,
} from "./api.js";

afterEach(() => vi.unstubAllGlobals());

const ok = (body: unknown) =>
  vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body });

describe("fetchExercises", () => {
  it("omits empty optional params from the query string", async () => {
    const f = ok({ items: [], nextCursor: null });
    vi.stubGlobal("fetch", f);
    await fetchExercises({ lang: "en", q: "", bodyPart: undefined });
    const url = f.mock.calls[0]![0] as string;
    expect(url).toContain("lang=en");
    expect(url).not.toContain("q=");
    expect(url).not.toContain("bodyPart=");
  });

  it("encodes Cyrillic queries", async () => {
    const f = ok({ items: [], nextCursor: null });
    vi.stubGlobal("fetch", f);
    await fetchExercises({ lang: "ru", q: "жим" });
    expect(f.mock.calls[0]![0]).toContain(encodeURIComponent("жим"));
  });
});

describe("fetchExerciseCount", () => {
  it("parses the total from the count route", async () => {
    vi.stubGlobal("fetch", ok({ total: 1324 }));
    await expect(fetchExerciseCount()).resolves.toEqual({ total: 1324 });
  });
});

describe("fetchExercise", () => {
  it("throws with the server error code on a failed response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: { code: "not_found", message: "nope" } }),
      }),
    );
    await expect(fetchExercise("9999", "en")).rejects.toThrow(/not_found/);
  });
});

describe("program writes", () => {
  const noContent = () =>
    vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
    });

  /**
   * The failure this guards against is quiet and confusing: `res.json()` on an
   * empty body throws, and a caller sees a rejected promise from a request the
   * server actually completed. The mutation looks failed, the UI shows an
   * error, and the change is nonetheless saved.
   */
  it("resolves a 204 rather than failing on an empty body", async () => {
    vi.stubGlobal("fetch", noContent());
    await expect(deleteProgram("p1")).resolves.toBeUndefined();
  });

  it.each([
    ["updateProgram", () => updateProgram("p1", { name: "x" })],
    ["deleteDay", () => deleteDay("d1")],
    ["reorderDays", () => reorderDays("p1", ["a", "b"])],
    ["reorderExercises", () => reorderExercises("d1", ["a", "b"])],
    ["updateExercise", () => updateExercise("e1", { notes: "x" })],
    ["deleteExercise", () => deleteExercise("e1")],
  ])("%s resolves on 204", async (_name, call) => {
    vi.stubGlobal("fetch", noContent());
    await expect(call()).resolves.toBeUndefined();
  });

  it("returns the new id from a create", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: "new-id" }) }),
    );
    await expect(createProgram({ name: "5×5", notes: null })).resolves.toBe("new-id");
  });

  it("sends the complete ordered list when reordering, not a from/to pair", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => null });
    vi.stubGlobal("fetch", f);
    await reorderDays("p1", ["c", "a", "b"]);

    const init = f.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({ ids: ["c", "a", "b"] });
  });

  it("surfaces the server's error code on a failed write", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: { code: "not_found", message: "no such program" } }),
      }),
    );
    await expect(deleteProgram("gone")).rejects.toThrow("not_found");
  });

  it("falls back to the status when the body is not an error envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError("not json");
        },
      }),
    );
    await expect(deleteProgram("p1")).rejects.toThrow("http_502");
  });
});

describe("fetchProgram", () => {
  it("passes the language through, since names come from the library join", async () => {
    const f = ok({
      id: "p1",
      name: "5×5",
      notes: null,
      icon: null,
      isActive: false,
      archivedAt: null,
      createdAt: 1,
      days: [],
    });
    vi.stubGlobal("fetch", f);
    await fetchProgram("p1", "ru");
    expect(f.mock.calls[0]![0]).toContain("lang=ru");
  });
});
