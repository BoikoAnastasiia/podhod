/**
 * Bindings declared in `wrangler.jsonc`, plus secrets that never appear
 * there (`.dev.vars` locally, `wrangler secret put` in production — see
 * README). Hand-maintained rather than produced by `wrangler types`, which
 * also emits a 15k-line copy of the runtime types that
 * `@cloudflare/workers-types` already provides.
 */
declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    ASSETS: Fetcher;
    /** Better Auth's session/cookie signing key. Never logged, never committed. */
    BETTER_AUTH_SECRET: string;
    /** Google OAuth client, from the owner's Google Cloud project. Never logged, never committed. */
    GOOGLE_CLIENT_ID: string;
    /** Google OAuth client secret. Never logged, never committed. */
    GOOGLE_CLIENT_SECRET: string;
  }
}

interface Env extends Cloudflare.Env {}
