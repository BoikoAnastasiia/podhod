/**
 * Bindings that exist only under test, injected by `vitest.config.ts`. Merged
 * into the same `Cloudflare.Env` the Worker sees, which is how `env` from
 * `cloudflare:test` is typed.
 */
declare namespace Cloudflare {
  interface Env {
    /** Every migration under apps/api/migrations. */
    TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
    /** Throwaway migrations under test/fixtures/migrations. */
    TEST_FIXTURE_MIGRATIONS: import("cloudflare:test").D1Migration[];
  }
}
