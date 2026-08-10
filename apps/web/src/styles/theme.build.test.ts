import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Tailwind 4 hoists a nested `@theme` out of its enclosing at-rule and merges
 * it into `:root` — so an `@theme` block written inside
 * `@media (prefers-color-scheme: dark)` does NOT stay conditional. It
 * overrides the light values unconditionally and the light theme never
 * renders. This only shows up in the *built* CSS: source inspection of
 * theme.css can't catch it because the bug is in how Tailwind's build step
 * interprets the nesting, not in anything a static check of the source can
 * see. So this test builds the app for real and inspects dist output,
 * exactly like the manual verification that caught the original defect.
 */
describe("theme.css build output", () => {
  it("keeps the light canvas unconditional and gates dark values behind prefers-color-scheme", () => {
    const webRoot = join(import.meta.dirname, "..", "..");
    const outDir = mkdtempSync(join(tmpdir(), "podhod-web-theme-test-"));
    try {
      execFileSync(join(webRoot, "node_modules", ".bin", "vite"), [
        "build",
        "--outDir",
        outDir,
        "--emptyOutDir",
      ], { cwd: webRoot, stdio: "pipe" });

      const assetsDir = join(outDir, "assets");
      const cssFile = readdirSync(assetsDir).find((f) => f.endsWith(".css"));
      if (!cssFile) throw new Error("no CSS asset emitted by the build");
      const css = readFileSync(join(assetsDir, cssFile), "utf8");

      // The regression this guards against emits zero media queries at all:
      // Tailwind hoists the nested @theme and the @media wrapper disappears.
      expect(css).toContain("prefers-color-scheme:dark");

      /*
       * Dark values are legitimate behind exactly two gates: any
       * prefers-color-scheme:dark media block (the "Auto" path) and any
       * rule whose selector carries [data-theme=dark] (the explicit user
       * choice). Strip both kinds of block, and whatever remains must be
       * pure light theme — a dark value surviving the strip is the
       * unconditional-override defect this test exists to catch.
       */
      const mediaBlocks = css.match(/@media\(prefers-color-scheme:dark\)\{[\s\S]*?\}\}/g) ?? [];
      expect(mediaBlocks.length).toBeGreaterThan(0);
      let outsideGates = css;
      for (const block of mediaBlocks) outsideGates = outsideGates.replace(block, "");
      const attrRules = outsideGates.match(/[^{}]*\[data-theme=dark\][^{]*\{[^{}]*\}/g) ?? [];
      expect(attrRules.length).toBeGreaterThan(0);
      for (const rule of attrRules) outsideGates = outsideGates.replace(rule, "");

      // Light canvas must render unconditionally.
      expect(outsideGates).toContain("#f4f5f6");
      // Dark canvas must not leak outside the two gates (that leak, with
      // the dark value winning at :root, was the original defect).
      expect(outsideGates).not.toContain("#121212");
      expect(mediaBlocks.some((b) => b.includes("#121212"))).toBe(true);
      expect(attrRules.some((r) => r.includes("#121212"))).toBe(true);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
    // Vitest's default 5s timeout is wrong for a test that shells out to a
    // real build: how long that takes is a property of the machine, not of
    // the code under test. It runs in 1-2s on a developer's laptop and blew
    // past 5s on CI, where the runner has fewer cores and `pnpm -r test`
    // has apps/api's pretest building this same app concurrently. A build
    // slow enough to exceed this ceiling is a broken runner, not a failed
    // assertion, so the number is deliberately far above any real duration.
  }, 120_000);
});
