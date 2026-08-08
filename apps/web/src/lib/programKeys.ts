import type { Lang } from "@podhod/schema";

/**
 * Query keys in one module rather than inline at each call site. A mutation has
 * to invalidate exactly the key a query used, and a typo in an inline array
 * fails silently — the request succeeds, the screen keeps showing stale data,
 * and nothing errors anywhere.
 *
 * The detail key carries `lang` because a program's exercise names come from
 * the library join and differ per language. Without it, switching language
 * would render the previous language's names straight from cache.
 */
export const programKeys = {
  all: ["programs"] as const,
  list: () => [...programKeys.all, "list"] as const,
  detail: (id: string, lang: Lang) => [...programKeys.all, "detail", id, lang] as const,
};
