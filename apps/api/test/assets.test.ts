import { errorResponseSchema } from "@podhod/schema";
import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("asset routing", () => {
  it("serves the SPA shell for an app route", async () => {
    const res = await SELF.fetch("https://x/library");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  it("returns a JSON 404 for an unknown API route, not the SPA shell", async () => {
    const res = await SELF.fetch("https://x/api/nope");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = errorResponseSchema.parse(await res.json());
    expect(body.error.code).toBe("not_found");
  });

  it("returns a JSON 404 for the bare /api path, not the SPA shell", async () => {
    const res = await SELF.fetch("https://x/api");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = errorResponseSchema.parse(await res.json());
    expect(body.error.code).toBe("not_found");
  });
});
