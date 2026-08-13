import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Playwright writes no report at all under its default reporter, so CI's
  // upload-artifact step had nothing to collect and warned on every run —
  // including the runs where e2e failed and the report was the thing worth
  // having. `github` annotates the failing line in the diff view; `html`
  // produces the artifact, and must not try to open a browser on a runner.
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: { baseURL: "http://localhost:5173" },
  /*
   * The Worker and the web server are started as two entries, not one `pnpm
   * dev`, because that script starts both — and CI was already starting the
   * Worker itself before calling Playwright. The second wrangler does not fail
   * when 8787 is taken; it quietly binds another port (observed: 8789) and
   * keeps running, so CI ended up with two Workers sharing one local D1
   * SQLite file. Two processes writing the same database is what made sign-up,
   * the only write on the critical path of every test, intermittently exceed a
   * five-second timeout: 17 tests failed that way in a single run while the
   * Worker itself logged no error at all.
   *
   * Listing both here means Playwright owns their lifetimes, waits for each to
   * answer before running, and starts exactly one of each. `reuseExistingServer`
   * keeps a developer's already-running `pnpm dev` in charge locally.
   */
  webServer: [
    {
      command: "pnpm --filter @podhod/api run dev",
      url: "http://localhost:8787/api/exercises",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "pnpm --filter @podhod/web run dev",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
