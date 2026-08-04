import type { Lang } from "@podhod/schema";

/**
 * Stand-in. Task 11 replaces this with a context-backed store returning
 * `{ lang, setLang, t, term, plural }`. This returns the subset Task 9 uses,
 * so the call sites written here keep compiling unchanged.
 */
export function useI18n(): { lang: Lang; term: (t: string) => string } {
  return { lang: "en", term: (t) => t };
}
