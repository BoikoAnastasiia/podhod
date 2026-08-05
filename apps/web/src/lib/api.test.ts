import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchExercise, fetchExerciseCount, fetchExercises } from "./api.js";

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
