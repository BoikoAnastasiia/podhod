import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@podhod/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema.js";

type Env = {
  Bindings: {
    DB: D1Database;
    BETTER_AUTH_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
  };
};

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
/**
 * Private-network address ranges, per RFC 1918 plus mDNS `.local` names — the
 * only hosts a phone on the same Wi-Fi can be reached at.
 */
const PRIVATE_HOST =
  /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|localhost$)|\.local$/;

/**
 * Origins Better Auth will accept a request from.
 *
 * Production gets exactly one entry and no request-dependent logic: the app is
 * same-origin by design, so the browser's Origin already equals the Worker's
 * own URL and nothing extra needs trusting. `http://localhost:5173` is there
 * for the dev proxy, as the comment at the call site explains.
 *
 * The extra clause exists so the app can be opened from a phone on the same
 * network during development, where Vite serves on a LAN address and Better
 * Auth would otherwise reject every request with INVALID_ORIGIN — correctly,
 * since that origin is neither the Worker's nor localhost.
 *
 * Two conditions gate it, and both matter. The *Worker itself* must be running
 * on localhost, which is only true under `wrangler dev` — in production the
 * request URL is the custom domain and this returns the fixed list untouched,
 * so none of it can be reached from the deployed app. And the origin being
 * trusted must be a private-network address, so this can never widen to a
 * public site. It is a development affordance that is structurally unable to
 * apply in production, rather than a relaxed rule that happens not to fire.
 */
function devOrigins(requestUrl: string, request: Request | undefined): string[] {
  const fixed = ["http://localhost:5173"];

  const worker = new URL(requestUrl).hostname;
  const workerIsLocal = worker === "localhost" || worker === "127.0.0.1";
  if (!workerIsLocal) return fixed;

  // Better Auth calls this without a request for some internal resolutions.
  const origin = request?.headers.get("origin");
  if (!origin) return fixed;
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== "http:" || !PRIVATE_HOST.test(hostname)) return fixed;
    return [...fixed, origin];
  } catch {
    return fixed;
  }
}

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
    trustedOrigins: (request) => devOrigins(requestUrl, request),
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    emailAndPassword: {
      enabled: true,
      // Cloudflare Email Sending requires the Workers Paid plan; the owner
      // declined it (its only benefit here was safe account linking for a
      // single-user app — see the account-linking comment below for the
      // manual alternative this phase ships instead). requireEmailVerification
      // therefore stays unset (falsy) permanently, not just "for now" — sign-up
      // completes immediately rather than gating on a step nothing can ever
      // satisfy. Every email+password account's emailVerified column stays
      // false forever as a result, which feeds directly into the
      // account-linking decision below.
      //
      // minPasswordLength/maxPasswordLength are set explicitly to the same
      // constants apps/web's sign-in/sign-up forms validate against
      // (packages/schema/src/auth.ts) rather than left to Better Auth's own
      // defaults (which happen to be these same numbers today): importing
      // one constant in two places can't drift, a coincidentally-matching
      // default silently could the moment either side's dependency updates.
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
    /**
     * Account linking is what happens when someone signs in with Google
     * using the same email as an existing email+password account. Better
     * Auth's own default here — confirmed against the installed 1.6.26
     * source (oauth2/link-account.mjs), not assumed — already refuses to
     * link automatically unless the *local* row already has
     * `emailVerified: true`, regardless of what Google itself asserts
     * about the address:
     *
     *   requireLocalEmailVerified = accountLinking?.requireLocalEmailVerified ?? true
     *
     * `requireLocalEmailVerified: true` is set explicitly here rather than
     * left implicit, so this security decision is visible in the config
     * rather than riding on a default someone could change without
     * noticing: without it, an attacker could pre-register any victim's
     * email with a password, then have the victim's real Google identity
     * silently merged into the attacker-controlled row the moment the
     * victim used "Continue with Google" — a silent account takeover, not
     * a bug that fails loudly.
     *
     * The cost: since requireEmailVerification is unset above and stays
     * unset permanently (email sending is cancelled for this app — see the
     * emailAndPassword comment), an email+password account's `emailVerified`
     * never becomes true, so *implicit* linking — clicking "Continue with
     * Google" on the sign-in/sign-up screen with an email that already has a
     * password account — always fails with an "account not linked" error.
     * Unlike the original comment here, that is not a temporary cost that
     * "resolves itself once verification ships": it is permanent, because
     * verification is never shipping. Lowering this flag to make the error
     * go away is exactly the silent-takeover hole two paragraphs up
     * describes — it stays `true`.
     *
     * The dead end this leaves needs a different fix, and Better Auth
     * already has one that needs no email at all: `authClient.linkSocial()`,
     * called from an *authenticated* session (see apps/web's /settings
     * route). Confirmed against the same source file — the manual link path
     * (`/link-social` plus its half of `/callback/:id` in
     * api/routes/account.mjs and api/routes/callback.mjs) never reads
     * `requireLocalEmailVerified` at all; it only checks that the signed-in
     * session's email matches the Google account being linked. That's
     * correct, not an oversight: being authenticated in the password account
     * *is* the proof of control that email verification would otherwise have
     * supplied, so gating manual linking on it too would just be demanding
     * the same proof twice. The unauthenticated, implicit path above has no
     * such proof to lean on — someone need only know a victim's email to
     * trigger it — which is exactly why it stays hard-blocked while the
     * authenticated path stays open. Automatic linking is never turned on
     * for the sign-in path itself; only a signed-in visitor acting on their
     * own account in Settings can link.
     *
     * New users who sign up with Google directly (no prior password account
     * at that email) are unaffected either way — that's plain OAuth sign-up,
     * not a link.
     *
     * (This option is marked deprecated in 1.6.26 with the gate becoming
     * unconditional in the next minor — i.e. Better Auth itself is moving
     * toward making this the only behavior. Setting it explicitly now costs
     * nothing when that lands.)
     */
    account: {
      accountLinking: {
        requireLocalEmailVerified: true,
      },
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
