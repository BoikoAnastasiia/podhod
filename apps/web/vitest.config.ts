import { defaultExclude, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Playwright owns everything under e2e/ (including its own *.spec.ts
    // files); vitest's default include pattern would otherwise try to
    // collect them too and the two runners' globals collide.
    exclude: [...defaultExclude, "e2e/**"],
  },
});
