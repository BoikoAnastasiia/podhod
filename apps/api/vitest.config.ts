import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Migrations are read in Node at config time and handed to the Worker as plain
 * bindings — the Worker has no filesystem, so this is the way across the
 * boundary. `readD1Migrations` sorts by the numeric filename prefix and splits
 * statements with wrangler's SQL-aware splitter, so line comments and
 * semicolons inside string literals survive intact.
 */
export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations(path.join(here, "migrations")),
          TEST_FIXTURE_MIGRATIONS: await readD1Migrations(
            path.join(here, "test", "fixtures", "migrations"),
          ),
          // Set here rather than read from .dev.vars: tests must pass on a
          // fresh checkout with no local secrets file, and this signs
          // nothing that outlives the test run. Not the production secret.
          BETTER_AUTH_SECRET: "test-only-secret-never-used-outside-vitest-pool",
        },
      },
    })),
  ],
});
