import type { ProgramDetail, ProgramListResponse } from "@podhod/schema";
import { SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { programRoutes } from "../src/routes/programs.js";
import { api, jsonHeaders, LINEAR, ORIGIN, setUpSchema, signUpAs } from "./programHelpers.js";

/**
 * The security property of this phase, in one place.
 *
 * Two users. Alice owns a program and an exercise entry. Bob then calls every
 * id-bearing route with Alice's ids; all must answer **404** — not 403, which
 * would confirm the row exists and belongs to somebody, and certainly not 200.
 *
 * The routes are a list rather than a case each, so the list itself is the
 * coverage claim — and the final test checks that claim against the router, so
 * an endpoint cannot be added without a matching entry here.
 */
let alice: ReturnType<typeof api>;
let bob: ReturnType<typeof api>;
let aliceIds: { programId: string; entryId: string };

beforeAll(async () => {
  await setUpSchema(["e1"]);

  alice = api(await signUpAs("alice@example.com"));
  const program = await alice.json<{ id: string }>(
    await alice.post("/api/programs", { name: "Alice's program" }),
  );
  const entry = await alice.json<{ id: string }>(
    await alice.post(`/api/programs/${program.id}/exercises`, {
      exerciseId: "e1",
      scheme: LINEAR,
    }),
  );
  aliceIds = { programId: program.id, entryId: entry.id };

  bob = api(await signUpAs("bob@example.com"));
});

type Ids = typeof aliceIds;

/**
 * Routes that name a specific row, and so can be probed with someone else's id.
 *
 * **Ordering is deliberate: the DELETEs come last, deepest first.** These cases
 * share one fixture, so a destructive route that wrongly succeeds destroys the
 * rows every later case depends on — and those cases then answer 404 correctly,
 * for entirely the wrong reason, hiding the bug. Verified by removing the user
 * scoping from ownership.ts: with the DELETEs in the middle, four cases failed;
 * with them last, ten do.
 */
const OWNED_ROUTES: {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  pattern: string;
  path: (ids: Ids) => string;
  body?: unknown;
}[] = [
  { method: "GET", pattern: "/:id", path: (i) => `/api/programs/${i.programId}` },
  { method: "PATCH", pattern: "/:id", path: (i) => `/api/programs/${i.programId}`, body: { name: "x" } },
  { method: "POST", pattern: "/:id/exercises", path: (i) => `/api/programs/${i.programId}/exercises`, body: { exerciseId: "e1", scheme: LINEAR } },
  { method: "PUT", pattern: "/:id/exercises/order", path: (i) => `/api/programs/${i.programId}/exercises/order`, body: { ids: ["x"] } },
  { method: "PATCH", pattern: "/exercises/:entryId", path: (i) => `/api/programs/exercises/${i.entryId}`, body: { notes: "x" } },
  { method: "DELETE", pattern: "/exercises/:entryId", path: (i) => `/api/programs/exercises/${i.entryId}` },
  { method: "DELETE", pattern: "/:id", path: (i) => `/api/programs/${i.programId}` },
];

/**
 * Collection routes name no row, so there is no foreign id to probe with. They
 * are covered by their own assertions below — that a listing shows only the
 * caller's programs, and that a create belongs to the caller — and listed here
 * so the completeness check can account for them.
 */
const COLLECTION_ROUTES = [
  { method: "GET", pattern: "/" },
  { method: "POST", pattern: "/" },
];

describe("another user's rows are invisible", () => {
  it.each(OWNED_ROUTES)("$method $pattern answers 404", async (route) => {
    const call = bob[route.method.toLowerCase() as "get"];
    const res = await call(route.path(aliceIds), route.body as never);
    expect(res.status).toBe(404);
  });

  it("leaves the owner's data completely intact after all of that", async () => {
    // Every call above should have refused before writing. If any of them
    // renamed, reordered or deleted something, it shows here.
    const detail = await alice.json<ProgramDetail>(
      await alice.get(`/api/programs/${aliceIds.programId}`),
    );
    expect(detail.name).toBe("Alice's program");
    expect(detail.exercises).toHaveLength(1);
    expect(detail.exercises[0]?.id).toBe(aliceIds.entryId);
  });
});

describe("collection routes are scoped to the caller", () => {
  it("lists only the caller's own programs", async () => {
    await bob.post("/api/programs", { name: "Bob's program" });

    const bobList = (await bob.json<ProgramListResponse>(await bob.get("/api/programs"))).programs;
    const aliceList = (await alice.json<ProgramListResponse>(await alice.get("/api/programs")))
      .programs;

    expect(bobList.map((p) => p.name)).toEqual(["Bob's program"]);
    expect(aliceList.every((p) => p.name !== "Bob's program")).toBe(true);
  });

  it("creates a program owned by the caller, not by anyone named in the body", async () => {
    // userId is taken from the session and never from the request. Sending one
    // must not plant a program in Alice's account.
    const res = await bob.post("/api/programs", {
      name: "planted",
      userId: "alice-id",
      user_id: "alice-id",
    });
    expect(res.status).toBe(201);

    const aliceList = (await alice.json<ProgramListResponse>(await alice.get("/api/programs")))
      .programs;
    expect(aliceList.some((p) => p.name === "planted")).toBe(false);
  });
});

describe("signed-out access", () => {
  it.each(OWNED_ROUTES)("$method $pattern answers 401 with no session", async (route) => {
    const res = await SELF.fetch(`${ORIGIN}${route.path(aliceIds)}`, {
      method: route.method,
      headers: jsonHeaders,
      ...(route.body === undefined ? {} : { body: JSON.stringify(route.body) }),
    });
    expect(res.status).toBe(401);
  });

  it("refuses to list programs with no session", async () => {
    const res = await SELF.fetch(`${ORIGIN}/api/programs`, { headers: jsonHeaders });
    expect(res.status).toBe(401);
  });

  it("refuses to create a program with no session", async () => {
    const res = await SELF.fetch(`${ORIGIN}/api/programs`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ name: "x" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("the ownership table is complete", () => {
  /**
   * Reads the mounted router and asserts every route it exposes is accounted
   * for above. Without this, adding an endpoint and forgetting to cover it
   * would be invisible: the suite would still pass, and the gap would be a
   * route nobody ever checked for cross-user access. It has already earned its
   * keep once, catching the two collection routes.
   */
  it("accounts for every route the program router exposes", () => {
    const mounted = programRoutes.routes
      // Hono records the `use("*")` middleware as a route too; only handlers
      // bound to a concrete method are endpoints.
      .filter((r) => r.method !== "ALL")
      .map((r) => `${r.method} ${r.path}`);

    const covered = new Set(
      [...OWNED_ROUTES, ...COLLECTION_ROUTES].map((r) => `${r.method} ${r.pattern}`),
    );
    const uncovered = [...new Set(mounted)].filter((r) => !covered.has(r));

    expect(uncovered).toEqual([]);
  });
});
