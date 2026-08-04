import type { Lang } from "@podhod/schema";
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { buildI18n, I18nContext } from "../i18n/useI18n.js";

const STORAGE_KEY = "podhod.lang";

export const Route = createRootRoute({ component: Shell });

function Shell() {
  const [lang, setLang] = useState<Lang>(
    () => (localStorage.getItem(STORAGE_KEY) as Lang | null) ?? "en",
  );

  // The static index.html ships lang="en"; a returning visitor with "ru"
  // persisted needs the <html lang> attribute synced on mount too, not only
  // inside the toggle handler below — otherwise a screen reader is told the
  // page is English while the content it reads is Russian.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const change = (next: Lang) => {
    localStorage.setItem(STORAGE_KEY, next);
    setLang(next);
  };

  return (
    <I18nContext.Provider value={buildI18n(lang, change)}>
      <div className="min-h-dvh bg-canvas text-ink">
        <div className="mx-auto w-full max-w-page">
          <header className="flex items-center justify-between gap-4 px-4 py-4">
            <Link to="/" className="text-xl font-bold tracking-tight">
              Подход
            </Link>
            <button
              type="button"
              data-testid="lang-toggle"
              onClick={() => change(lang === "en" ? "ru" : "en")}
              className="min-h-tap-min rounded-full bg-surface px-4 text-sm"
            >
              {lang === "en" ? "RU" : "EN"}
            </button>
          </header>
          <main className="px-4 pb-16">
            <Outlet />
          </main>
        </div>
      </div>
    </I18nContext.Provider>
  );
}
