import type { Lang } from "@podhod/schema";
import { createContext, useContext } from "react";
import taxonomyRu from "../../../../data/taxonomy.ru.json" with { type: "json" };
import { dict } from "./dict.js";
import { plural } from "./plural.js";

export type I18n = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  /** Translates a taxonomy term (body part, equipment, target, muscle). */
  term: (value: string) => string;
  plural: (n: number, forms: Parameters<typeof plural>[2]) => string;
};

export const I18nContext = createContext<I18n | null>(null);

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n used outside I18nContext");
  return ctx;
}

export function buildI18n(lang: Lang, setLang: (l: Lang) => void): I18n {
  const taxonomy = taxonomyRu as Record<string, string>;
  return {
    lang,
    setLang,
    t: (key) => dict[lang][key] ?? key,
    term: (value) => (lang === "ru" ? (taxonomy[value] ?? value) : value),
    plural: (n, forms) => plural(lang, n, forms),
  };
}
