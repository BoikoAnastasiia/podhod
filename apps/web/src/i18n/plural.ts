import type { Lang } from "@podhod/schema";

type Forms = Partial<Record<Intl.LDMLPluralRule, string>>;

const rules: Record<Lang, Intl.PluralRules> = {
  en: new Intl.PluralRules("en"),
  ru: new Intl.PluralRules("ru"),
};

/**
 * Russian selects between three forms (подход / подхода / подходов) on rules
 * that are not derivable from the number alone — 21 takes the same form as 1,
 * 11 does not. Intl.PluralRules is the correct source of truth; a library for
 * ~150 strings would not be.
 */
export function plural(lang: Lang, n: number, forms: Forms): string {
  const category = rules[lang].select(n);
  return forms[category] ?? forms.other ?? "";
}
