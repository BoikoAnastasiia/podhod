import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema.js";

type Env = { Bindings: { DB: D1Database; BETTER_AUTH_SECRET: string } };

/**
 * Built per-request, not once at module scope: the D1 binding only exists
 * inside a request's `env`, and a Worker has no module-level access to it —
 * every other route in this app (see routes/exercises.ts) already calls
 * `drizzle(c.env.DB)` per request for the same reason. Constructing
 * `betterAuth()` does no I/O by itself, so paying that setup cost per
 * request is the tradeoff this platform imposes, not a real one.
 *
 * `baseURL` is read off the incoming request's own origin rather than a
 * fixed env var: the app is same-origin by design (docs/design.md §2), so
 * the Worker's own URL — localhost:8787 in dev, the custom domain in
 * production — is always the correct baseURL, and deriving it removes one
 * more value that could drift between environments.
 */
export function createAuth(env: Env["Bindings"], requestUrl: string) {
  const db = drizzle(env.DB, { schema });

  return betterAuth({
    baseURL: new URL(requestUrl).origin,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    // vite.config.ts proxies apps/web's dev server (5173) to this Worker
    // (8787) so the client never has to branch on environment — but the
    // proxy forwards the browser's real Origin header unchanged, so from
    // this Worker's side a dev request looks like it's arriving from
    // localhost:5173 while baseURL above resolves to localhost:8787.
    // Without this, Better Auth's Origin-must-match-baseURL check (real
    // CSRF protection — confirmed by trying to sign up through the dev
    // proxy and getting INVALID_ORIGIN) rejects every dev request. Adding
    // this origin costs nothing in production: nobody's browser is ever
    // actually at localhost:5173 unless they're already running this repo
    // locally, and Origin can't be forged by a page hosted elsewhere.
    trustedOrigins: ["http://localhost:5173"],
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    emailAndPassword: {
      enabled: true,
      // Cloudflare Email Sending and the verification gate it enables are
      // later phase-1b work, gated on credentials the owner is still
      // provisioning — requireEmailVerification stays unset (falsy) so
      // sign-up completes immediately rather than gating on a step nothing
      // can satisfy yet. Google OAuth is the same story: added later, not
      // stubbed here.
    },
    databaseHooks: {
      user: {
        create: {
          // Gives every account a settings row from the moment it exists,
          // per docs/design.md §3 — the client never has to handle a
          // signed-in user with no user_settings yet. Every column but
          // userId is left off so SQLite applies the schema's own defaults
          // (see db/schema.ts) instead of duplicating them here.
          after: async (user) => {
            await db.insert(schema.userSettings).values({ userId: user.id });
          },
        },
      },
    },
  });
}
