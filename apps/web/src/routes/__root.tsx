import type { Lang } from "@podhod/schema";
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Footer } from "../components/Footer.js";
import { Nav } from "../components/Nav.js";
import { UserMenu } from "../components/UserMenu.js";
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
      {/* flex-col + flex-1 on <main> pins the footer to the viewport bottom
          on short pages instead of letting it float mid-canvas. */}
      <div className="flex min-h-dvh flex-col bg-canvas text-ink">
        {/*
         * The band is full-bleed; the *content* inside it shares the same
         * max-w-page + px-4 box as <main>, so the header's edges and the
         * page's edges land on the same lines — the earlier layout bounded
         * the whole header at max-w-page, which left the bar's content
         * narrower than the viewport and wider than the page content at
         * once ("messy" was the owner's word for it, accurately).
         */}
        <header className="bg-header text-header-ink">
          {/*
           * The gutter scale below (4 → 8 → 16 → 28) must stay identical on
           * this box, on <main>, and (negated) on the landing's hero bleed —
           * three copies of one number. Metacritic-calibrated: ~112px of
           * breathing room at desktop widths instead of a 16px sliver.
           */}
          {/*
           * Three ordered pieces, rearranged by viewport. Narrow: wordmark
           * left and avatar right share the first row (the mobile app-bar
           * convention), the nav wraps to a full-width second row. From sm:
           * one row — wordmark left, then nav+avatar as one right group.
           */}
          <div className="mx-auto flex w-full max-w-page flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 sm:px-8 lg:px-16 xl:px-28">
            {/*
             * Revalia (see theme.css) only — the wordmark is the one place
             * this display face is used. font-normal because the
             * self-hosted file has just the one (400) weight; asking for
             * bold would make the browser synthesize a fake one.
             */}
            <Link
              to="/"
              className="order-1 flex min-h-tap-min items-center font-wordmark text-lg font-normal"
            >
              {i18n.t("brand.wordmark")}
            </Link>
            <Nav />
            <span className="order-2 ml-auto sm:order-3 sm:ml-0">
              <UserMenu />
            </span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-page flex-1 px-4 pb-16 sm:px-8 lg:px-16 xl:px-28">
          <Outlet />
        </main>
        <Footer />
      </div>
    </I18nContext.Provider>
  );
}
