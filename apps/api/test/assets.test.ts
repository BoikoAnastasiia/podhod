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
  });
});
