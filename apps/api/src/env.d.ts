/**
 * Bindings declared in `wrangler.jsonc`. Hand-maintained rather than produced
 * by `wrangler types`, which also emits a 15k-line copy of the runtime types
 * that `@cloudflare/workers-types` already provides. Keep in sync with
 * `wrangler.jsonc` — there are only two bindings.
 */
declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    ASSETS: Fetcher;
  }
}

interface Env extends Cloudflare.Env {}
