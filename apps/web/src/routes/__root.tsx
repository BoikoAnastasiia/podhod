import type { Lang } from "@podhod/schema";
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Footer } from "../components/Footer.js";
import { Nav } from "../components/Nav.js";
import { ToastProvider } from "../components/Toast.js";
import { UserMenu } from "../components/UserMenu.js";
import { buildI18n, I18nContext } from "../i18n/useI18n.js";
import {
  THEME_STORAGE_KEY,
  ThemeContext,
  type ThemeChoice,
} from "../lib/themeContext.js";

const STORAGE_KEY = "podhod.lang";

export const Route = createRootRoute({ component: Shell });

/**
 * The header never changes height, and that is load-bearing rather than merely
 * simple.
 *
 * It used to shed its nav row on a phone when you scrolled down. The owner's
 * call (2026-08-13), after seeing it: half a header reads worse than the space
 * it saves. Removing it also removed the mechanism that made it dangerous —
 * while the header was in flow *and* changing height, collapsing the nav row
 * deleted 48px from above the viewport, scroll anchoring compensated by the
 * same 48px, that read as scrolling up, the row came back, and the position
 * alternated between 900 and 852 forever at frame rate.
 *
 * So it is `sticky` again, in flow, with no spacer and no reservation to keep
 * in step: a fixed-height sticky header cannot start that loop. If a future
 * change makes this header's height depend on scrolling, it must leave the flow
 * first — that was the whole reason it was `fixed`.
 */

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

  const [theme, setThemeState] = useState<ThemeChoice>(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  });

  // The attribute, not a class: theme.css gates its dark values on
  // [data-theme] — absent means "let prefers-color-scheme decide".
  useEffect(() => {
    if (theme === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);

  const setTheme = (next: ThemeChoice) => {
    if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, next);
    setThemeState(next);
  };

  const i18n = buildI18n(lang, change);
  const headerRef = useRef<HTMLElement>(null);

  /**
   * The header's height, for anything that has to clear it — the toasts, today.
   * Still observed rather than assumed, because it differs between the one-row
   * desktop header and the two-row phone one, and changes when the viewport
   * crosses that breakpoint.
   *
   * React state rather than a CSS custom property on :root. The variable
   * version wrote 0px whenever it measured a header that was momentarily
   * detached — a hot reload was enough — and since nothing rewrites a stale
   * variable, every toast after that rendered *inside* the black band. State
   * re-derives from the live tree instead, and the zero guard below keeps a
   * transient measurement from being believed at all.
   */
  const [headerHeight, setHeaderHeight] = useState(0);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const measure = () => {
      const height = el.offsetHeight;
      if (height > 0) setHeaderHeight(height);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, []);

  return (
    <I18nContext.Provider value={i18n}>
    <ThemeContext.Provider value={{ theme, setTheme }}>
    <ToastProvider topOffset={headerHeight}>
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
        {/*
         * Pinned. z-30 clears the page's own stacking (cards, the library's own
         * sticky filters) but sits below the top layer, so a <dialog> or a
         * popover still covers it rather than fighting it.
         */}
        <header ref={headerRef} className="sticky top-0 z-30 bg-header text-header-ink">
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
    </ToastProvider>
    </ThemeContext.Provider>
    </I18nContext.Provider>
  );
}
