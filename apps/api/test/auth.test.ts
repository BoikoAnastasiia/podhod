import { errorResponseSchema, meResponseSchema } from "@podhod/schema";
import { env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { applyMigrations } from "./helpers.js";

beforeAll(async () => {
  await applyMigrations(env.DB);
});

/**
 * Better Auth checks the request's Origin against its baseURL for
 * state-changing endpoints (confirmed against a real sign-out call in local
 * dev — sign-out 403'd with MISSING_OR_NULL_ORIGIN until this header was
 * added). `createAuth` derives baseURL from the request's own origin (see
 * src/lib/auth.ts), so using that same origin here is what makes it match,
 * exactly like a same-origin browser request would.
 */
const ORIGIN = "https://example.com";
const jsonHeaders = { "content-type": "application/json", origin: ORIGIN };

/**
 * `SELF.fetch` has no cookie jar of its own — each call is an independent
 * request, same as any other `fetch`. This turns a response's Set-Cookie
 * headers into the single Cookie header the next request needs, dropping
 * the attributes (Path, HttpOnly, SameSite, Max-Age) a real cookie jar
 * would strip before resending anyway.
 */
function cookieHeaderFrom(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

async function signUp(email: string, password: string, name: string): Promise<Response> {
  return SELF.fetch(`${ORIGIN}/api/auth/sign-up/email`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ email, password, name }),
  });
}

describe("auth", () => {
  it("signs up, and the session persists across requests via the returned cookie", async () => {
    const res = await signUp("alice@example.com", "correct-horse-1", "Alice");
    expect(res.status).toBe(200);
    const cookie = cookieHeaderFrom(res);
    expect(cookie).not.toBe("");

    const me = await SELF.fetch(`${ORIGIN}/api/me`, { headers: { cookie } });
    expect(me.status).toBe(200);
    const body = meResponseSchema.parse(await me.json());
    expect(body.user.email).toBe("alice@example.com");

    // The signup hook (src/lib/auth.ts) creates a user_settings row with
    // every column left to its SQL default, per docs/design.md §3.
    expect(body.settings).toEqual({
      locale: "en",
      units: "kg",
      plateIncrementKg: 2.5,
      defaultRestSeconds: 90,
      theme: "system",
    });
  });

  it("rejects a protected route with no session, using the shared error envelope", async () => {
    const res = await SELF.fetch(`${ORIGIN}/api/me`);
    expect(res.status).toBe(401);
    const body = errorResponseSchema.parse(await res.json());
    expect(body.error.code).toBe("unauthorized");
  });

  it("signs in with a previously created account and gets back a working session", async () => {
    await signUp("bob@example.com", "correct-horse-2", "Bob");

    const signIn = await SELF.fetch(`${ORIGIN}/api/auth/sign-in/email`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ email: "bob@example.com", password: "correct-horse-2" }),
    });
    expect(signIn.status).toBe(200);

    const me = await SELF.fetch(`${ORIGIN}/api/me`, { headers: { cookie: cookieHeaderFrom(signIn) } });
    expect(me.status).toBe(200);
    expect(meResponseSchema.parse(await me.json()).user.email).toBe("bob@example.com");
  });

  it("rejects sign-in with the wrong password", async () => {
    await signUp("carol@example.com", "correct-horse-3", "Carol");

    const res = await SELF.fetch(`${ORIGIN}/api/auth/sign-in/email`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ email: "carol@example.com", password: "not-the-password" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects a sign-up with an email already in use", async () => {
    await signUp("dana@example.com", "correct-horse-4", "Dana");

    const res = await signUp("dana@example.com", "a-different-password", "Dana Two");
    expect(res.status).toBe(422);
  });

  it("signs out and invalidates the session", async () => {
    const signUpRes = await signUp("erin@example.com", "correct-horse-5", "Erin");
    const cookie = cookieHeaderFrom(signUpRes);

    const signOut = await SELF.fetch(`${ORIGIN}/api/auth/sign-out`, {
      method: "POST",
      headers: { ...jsonHeaders, cookie },
      body: "{}",
    });
    expect(signOut.status).toBe(200);

    const me = await SELF.fetch(`${ORIGIN}/api/me`, { headers: { cookie } });
    expect(me.status).toBe(401);
  });
});
