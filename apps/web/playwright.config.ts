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
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
  },
});
