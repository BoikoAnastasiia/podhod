import { env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { applyMigrations } from "./helpers.js";

beforeAll(async () => {
  await applyMigrations(env.DB);
});

// See apps/api/test/auth.test.ts for why this exact origin is used.
const ORIGIN = "https://example.com";
const jsonHeaders = { "content-type": "application/json", origin: ORIGIN };

function cookieHeaderFrom(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

async function signUp(email: string, password: string, name: string): Promise<string> {
  const res = await SELF.fetch(`${ORIGIN}/api/auth/sign-up/email`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ email, password, name }),
  });
  expect(res.status).toBe(200);
  return cookieHeaderFrom(res);
}

async function userIdFor(cookie: string): Promise<string> {
  const me = await SELF.fetch(`${ORIGIN}/api/me`, { headers: { cookie } });
  const body = (await me.json()) as { user: { id: string } };
  return body.user.id;
}

/**
 * Better Auth has no email-based way to add a second `account` row in this
 * test environment (linking Google for real needs a live consent screen —
 * see e2e/auth.spec.ts's own comment on why that's never exercised here).
 * Inserting the row directly is the same shortcut: `/link-social`'s actual
 * job is producing exactly this row (see api/routes/account.mjs), so what's
 * under test here — `/list-accounts` and `/unlink-account`'s last-method
 * guard — never touches the OAuth handshake this sidesteps.
 */
async function insertGoogleAccount(userId: string): Promise<void> {
  // created_at/updated_at have no SQL-level DEFAULT (see db/auth-schema.ts —
  // updated_at is only ever set by Drizzle's own `.$onUpdate`, which this
  // raw insert bypasses), so both are supplied explicitly.
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO account (id, account_id, provider_id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(crypto.randomUUID(), "google-test-account-id", "google", userId, now, now)
    .run();
}

describe("account linking", () => {
  it("lists the credential account a plain email+password sign-up creates", async () => {
    const cookie = await signUp("ivy@example.com", "correct-horse-8", "Ivy");

    const res = await SELF.fetch(`${ORIGIN}/api/auth/list-accounts`, { headers: { cookie } });
    expect(res.status).toBe(200);
    const accounts = (await res.json()) as Array<{ providerId: string }>;
    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.providerId).toBe("credential");
  });

  it("requires a session to list accounts", async () => {
    const res = await SELF.fetch(`${ORIGIN}/api/auth/list-accounts`);
    expect(res.status).toBe(401);
  });

  /**
   * The requirement this repo cannot skip: unlinking a user's only
   * remaining sign-in method would lock them out permanently. Better Auth's
   * own `/unlink-account` endpoint enforces this (accountLinking.
   * allowUnlinkingAll is left at its default — see auth.ts) — this proves
   * that guard actually fires against a real single-account user rather
   * than trusting the framework's default silently continuing to hold.
   */
  it("refuses to unlink a user's only remaining sign-in method", async () => {
    const cookie = await signUp("jack@example.com", "correct-horse-9", "Jack");

    const res = await SELF.fetch(`${ORIGIN}/api/auth/unlink-account`, {
      method: "POST",
      headers: { ...jsonHeaders, cookie },
      body: JSON.stringify({ providerId: "credential" }),
    });
    expect(res.status).toBe(400);

    // Confirms the account survived the rejected attempt.
    const list = await SELF.fetch(`${ORIGIN}/api/auth/list-accounts`, { headers: { cookie } });
    const accounts = (await list.json()) as Array<{ providerId: string }>;
    expect(accounts).toHaveLength(1);
  });

  it("allows unlinking when a second sign-in method remains", async () => {
    const cookie = await signUp("kate@example.com", "correct-horse-10", "Kate");
    const userId = await userIdFor(cookie);
    await insertGoogleAccount(userId);

    const before = await SELF.fetch(`${ORIGIN}/api/auth/list-accounts`, { headers: { cookie } });
    expect(((await before.json()) as unknown[]).length).toBe(2);

    const unlink = await SELF.fetch(`${ORIGIN}/api/auth/unlink-account`, {
      method: "POST",
      headers: { ...jsonHeaders, cookie },
      body: JSON.stringify({ providerId: "google" }),
    });
    expect(unlink.status).toBe(200);

    const after = await SELF.fetch(`${ORIGIN}/api/auth/list-accounts`, { headers: { cookie } });
    const accounts = (await after.json()) as Array<{ providerId: string }>;
    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.providerId).toBe("credential");

    // Now back down to one method — the guard must engage again.
    const secondUnlink = await SELF.fetch(`${ORIGIN}/api/auth/unlink-account`, {
      method: "POST",
      headers: { ...jsonHeaders, cookie },
      body: JSON.stringify({ providerId: "credential" }),
    });
    expect(secondUnlink.status).toBe(400);
  });
});
