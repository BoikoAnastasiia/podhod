import { fixedTarget } from "./schemes/fixed.js";
import type { NextTargetOptions, Performance, Scheme, Target } from "./types.js";

/**
 * Compute what to lift next.
 *
 * `history` is most-recent-first and holds working sets only — the caller drops
 * warmups, so this function never has to know what one is. Ordering is the only
 * temporal information here; there is deliberately no clock, which is what makes
 * every rule assertable with a literal input and a literal expectation.
 */
export function nextTarget(
  scheme: Scheme,
  history: Performance[],
  options: NextTargetOptions,
): Target {
  switch (scheme.kind) {
    case "fixed":
      return fixedTarget(scheme, history, options);
    default:
      // Replaced by a `never` exhaustiveness check once every scheme has a
      // branch, so that a fifth scheme becomes a compile error rather than a
      // runtime one.
      throw new Error(`unhandled scheme kind: ${scheme.kind}`);
  }
}
