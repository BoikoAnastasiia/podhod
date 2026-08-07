import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The engine's testability rests entirely on it having no clock, no I/O and no
 * randomness — that is what lets every rule be asserted with a literal input and
 * a literal expectation. It is also exactly the kind of property that erodes:
 * one `new Date()` added for a "quick" default and the package needs mocks
 * forever. This reads the source rather than the behaviour, because a clock
 * added down an untested branch would not show up any other way.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith(".ts") ? [full] : [];
  });
}

const FORBIDDEN = [
  { pattern: /\bnew Date\b/, why: "clock construction" },
  { pattern: /\bDate\.now\b/, why: "clock reads" },
  { pattern: /\bMath\.random\b/, why: "randomness" },
  { pattern: /from ["']node:/, why: "Node built-ins" },
  { pattern: /\bfetch\s*\(/, why: "network I/O" },
];

describe("packages/core stays pure", () => {
  const files = sourceFiles(join(import.meta.dirname, "..", "src"));

  it("finds source files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const { pattern, why } of FORBIDDEN) {
    it(`contains no ${why} (${pattern.source})`, () => {
      const offenders = files.filter((f) => pattern.test(readFileSync(f, "utf8")));
      expect(offenders).toEqual([]);
    });
  }
});
