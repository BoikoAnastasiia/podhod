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

      const darkBlockMatch = css.match(/@media\(prefers-color-scheme:dark\)\{[\s\S]*?\}\}/);
      expect(darkBlockMatch).not.toBeNull();
      const darkBlock = darkBlockMatch![0];
      const outsideDarkBlock = css.replace(darkBlock, "");

      // Light canvas must render unconditionally.
      expect(outsideDarkBlock).toContain("#f5f5f3");
      // Dark canvas must be gated — it must not leak outside the media query
      // (that leak, with the dark value winning at :root, was the defect).
      expect(outsideDarkBlock).not.toContain("#0e0e0e");
      expect(darkBlock).toContain("#0e0e0e");
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});
