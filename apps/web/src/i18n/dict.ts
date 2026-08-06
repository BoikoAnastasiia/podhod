import type { Lang } from "@podhod/schema";
import type { plural } from "./plural.js";

export const dict = {
  en: {
    // English is the primary brand language now; "PODHOD" is the Latin
    // wordmark and is intentionally identical in both locales below — it's
    // a brand name, not a translated word (see docs/design.md).
    "brand.wordmark": "PODHOD",
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
    "landing.tagline":
      "Подход means both “a set” and “an approach” in Russian. This one starts as an exercise library and grows into a full training program tracker.",
    "landing.stat.loading": "Counting the library…",
    "landing.stat.error": "Couldn't reach the library just now.",
    "landing.stat.rest": "in the library, searchable in both Russian and English.",
    "landing.today.heading": "What's here today",
    "landing.today.body":
      "A bilingual exercise library: search by name, filter by body part, and open any exercise for step-by-step instructions and a demonstration.",
    "landing.coming.heading": "What's coming next",
    "landing.coming.body":
      "Training programs with progression rules that calculate your next target automatically, and a guided session player that walks you through the workout set by set. Not built yet — the library above is what's live.",
    "footer.github": "View source on GitHub",
    "detail.instructions": "Instructions",
    "detail.secondaryMuscles": "Also works",
    "auth.signIn": "Sign in",
    "auth.signOut": "Sign out",
    "auth.signInTitle": "Sign in",
    "auth.signUpTitle": "Create an account",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.submitSignIn": "Sign in",
    "auth.submitSignUp": "Create account",
    "auth.submitting": "Working…",
    "auth.switchToSignUpPrefix": "Don't have an account?",
    "auth.switchToSignUpLink": "Sign up",
    "auth.switchToSignInPrefix": "Already have an account?",
    "auth.switchToSignInLink": "Sign in",
    "auth.or": "or",
    "auth.continueWithGoogle": "Continue with Google",
    "auth.error.invalidCredentials": "That email or password isn't right.",
    "auth.error.emailInUse": "An account with that email already exists.",
    "auth.error.generic": "Something went wrong. Try again.",
    "settings.title": "Settings",
    "settings.account": "Account",
    "settings.loading": "Loading your settings…",
  },
  ru: {
    "brand.wordmark": "PODHOD",
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
    "landing.tagline":
      "Подход — это и «сет», и «подход к делу». Сейчас это библиотека упражнений, а вырастет в полноценный трекер программ тренировок.",
    "landing.stat.loading": "Считаем библиотеку…",
    "landing.stat.error": "Не удалось связаться с библиотекой.",
    "landing.stat.rest": "в библиотеке — с поиском на русском и английском.",
    "landing.today.heading": "Что есть уже сегодня",
    "landing.today.body":
      "Двуязычная библиотека упражнений: поиск по названию, фильтр по группе мышц, а в карточке каждого упражнения — пошаговая инструкция и демонстрация.",
    "landing.coming.heading": "Что будет дальше",
    "landing.coming.body":
      "Программы тренировок с правилами прогрессии, которые сами считают следующий вес и число повторений, и режим тренировки, который ведёт вас по сетам. Пока не реализовано — выше показано только то, что уже работает.",
    "footer.github": "Исходный код на GitHub",
    "detail.instructions": "Инструкция",
    "detail.secondaryMuscles": "Также задействует",
    "auth.signIn": "Войти",
    "auth.signOut": "Выйти",
    "auth.signInTitle": "Вход",
    "auth.signUpTitle": "Регистрация",
    "auth.email": "Email",
    "auth.password": "Пароль",
    "auth.submitSignIn": "Войти",
    "auth.submitSignUp": "Создать аккаунт",
    "auth.submitting": "Подождите…",
    "auth.switchToSignUpPrefix": "Нет аккаунта?",
    "auth.switchToSignUpLink": "Зарегистрироваться",
    "auth.switchToSignInPrefix": "Уже есть аккаунт?",
    "auth.switchToSignInLink": "Войти",
    "auth.or": "или",
    "auth.continueWithGoogle": "Продолжить с Google",
    "auth.error.invalidCredentials": "Неверный email или пароль.",
    "auth.error.emailInUse": "Аккаунт с таким email уже существует.",
    "auth.error.generic": "Что-то пошло не так. Попробуйте ещё раз.",
    "settings.title": "Настройки",
    "settings.account": "Аккаунт",
    "settings.loading": "Загружаем настройки…",
  },
} satisfies Record<Lang, Record<string, string>>;

/**
 * Not part of `dict` above: `t()` returns a flat string per key, but this
 * noun's ending depends on the count in front of it (Russian selects between
 * three plural forms), so it is composed with `plural()` at the call site
 * instead of being a single fixed translation.
 */
export const exerciseNounForms: Record<Lang, Parameters<typeof plural>[2]> = {
  en: { one: "exercise", other: "exercises" },
  ru: { one: "упражнение", few: "упражнения", many: "упражнений" },
};
