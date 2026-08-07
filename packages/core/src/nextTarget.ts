import { doubleTarget } from "./schemes/double.js";
import { fixedTarget } from "./schemes/fixed.js";
import { linearTarget } from "./schemes/linear.js";
import { rpeTarget } from "./schemes/rpe.js";
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
    case "linear":
      return linearTarget(scheme, history, options);
    case "double":
      return doubleTarget(scheme, history, options);
    case "rpe":
      return rpeTarget(scheme, history, options);
    default: {
      // Adding a fifth scheme fails to compile here rather than falling through
      // to a wrong answer at runtime. The throw is unreachable while the union
      // is exhaustive; it exists for callers who reach this from untyped JSON.
      const unreachable: never = scheme;
      throw new Error(`unhandled scheme: ${JSON.stringify(unreachable)}`);
    }
  }
}
