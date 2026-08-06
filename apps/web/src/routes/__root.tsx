import type { Lang } from "@podhod/schema";
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Nav } from "../components/Nav.js";
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

  const i18n = buildI18n(lang, change);

  return (
    <I18nContext.Provider value={i18n}>
      <div className="min-h-dvh bg-canvas text-ink">
        <div className="mx-auto w-full max-w-page">
          <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-4">
            <div className="flex flex-wrap items-center gap-3">
              {/*
               * Revalia (see theme.css) only — the wordmark is the one
               * place this display face is used. font-normal because the
               * self-hosted file has just the one (400) weight; asking for
               * bold here would make the browser synthesize a fake one.
               * Kept at text-base (not larger): measured at 320px, the nav
               * pill plus the Russian "Упражнения" label plus the EN/RU
               * toggle already fill the row, and text-lg or text-xl here
               * pushed the header past 320px and failed
               * locale.spec.ts's narrow-viewport overflow check. This is
               * the header — the hero heading below is where Revalia's H
               * gets room to actually read.
               *
               * The header and this group both wrap (flex-wrap, not a
               * fixed single row) since Phase 1b added a session-aware
               * pill to Nav whose width varies with the signed-in
               * account's email — a budget that can no longer be measured
               * once at 320px and assumed fixed. Wrapping is what keeps
               * locale.spec.ts's overflow check honest as Nav grows in
               * Phase 2 instead of re-measuring the header every time.
               */}
              <Link
                to="/"
                className="flex min-h-tap-min items-center rounded-full px-2 font-wordmark text-base font-normal"
              >
                {i18n.t("brand.wordmark")}
              </Link>
              <Nav />
            </div>
            <button
              type="button"
              data-testid="lang-toggle"
              onClick={() => change(lang === "en" ? "ru" : "en")}
              aria-label={lang === "en" ? i18n.t("lang.switchToRu") : i18n.t("lang.switchToEn")}
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
