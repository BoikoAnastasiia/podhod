import type { Lang } from "@podhod/schema";

export const dict = {
  en: {
    "nav.library": "Library",
    "library.search": "Search exercises",
    "library.loading": "Loading…",
    "library.empty": "Nothing matches those filters.",
    "library.error": "Something went wrong loading the library.",
    "library.retry": "Retry",
    "library.loadMore": "Load more",
    "home.browseLibrary": "Browse the library",
    "lang.switchToRu": "Switch to Russian",
    "lang.switchToEn": "Switch to English",
  },
  ru: {
    "nav.library": "Упражнения",
    "library.search": "Поиск упражнений",
    "library.loading": "Загрузка…",
    "library.empty": "Ничего не найдено.",
    "library.error": "Не удалось загрузить библиотеку.",
    "library.retry": "Повторить",
    "library.loadMore": "Показать ещё",
    "home.browseLibrary": "Открыть библиотеку",
    "lang.switchToRu": "Переключить на русский",
    "lang.switchToEn": "Переключить на английский",
  },
} satisfies Record<Lang, Record<string, string>>;
