import type { Lang } from "@podhod/schema";

export const dict: Record<Lang, Record<string, string>> = {
  en: {
    "nav.library": "Library",
    "library.search": "Search exercises",
    "library.loading": "Loading…",
    "library.empty": "Nothing matches those filters.",
  },
  ru: {
    "nav.library": "Упражнения",
    "library.search": "Поиск упражнений",
    "library.loading": "Загрузка…",
    "library.empty": "Ничего не найдено.",
  },
};
