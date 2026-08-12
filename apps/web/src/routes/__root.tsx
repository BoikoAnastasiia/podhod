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

/** Below this much scrolling the header is never compacted — a few pixels of
 *  overscroll should not collapse anything. */
const COMPACT_AFTER = 64;

/**
 * Whether the pinned header should shed its second row.
 *
 * Only mobile has a second row to shed: from sm the header is a single row and
 * this returns false for it via the media query. Scrolling *up* always expands
 * it again, which is the part that matters — UserMenu holds language, theme and
 * sign-out but no navigation, so a header that collapsed for good would leave a
 * phone with no way back to the library short of scrolling to the top.
 *
 * Scroll-state container queries would do this in CSS, but they are Chromium-
 * only; one passive listener coalesced into an animation frame is the portable
 * version, and it reads scrollY rather than measuring layout, so it never
 * forces a reflow.
 *
 * The header is taken out of flow by the shell (see the reservation spacer)
 * because of this hook, not incidentally. While it was `sticky` and in flow,
 * collapsing the nav row removed 48px of content from above the viewport,
 * scroll anchoring compensated by moving the scroll position 48px up, that read
 * here as scrolling up, the row came back, and the two states oscillated at
 * frame rate — measured, 800px and 752px alternating forever. Out of flow, the
 * height change moves nothing, so the reading stays honest.
 */
function useCompactHeader() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const wide = window.matchMedia("(min-width: 40rem)");
    let last = window.scrollY;
    let queued = false;

    /**
     * The threshold is not polish, it is correctness: one scrollTo can deliver
     * several scroll events, and the trailing ones report the same offset as
     * the one before. Treating "no movement" as a direction made the header
     * expand again the instant it collapsed. Only a real delta may flip it, and
     * 4px of it, so a trackpad's jitter cannot make the row flicker either.
     */
    const measure = () => {
      queued = false;
      const y = window.scrollY;
      const delta = y - last;

      // Near the top, and on any viewport wide enough to show one row, the
      // header is always whole.
      if (wide.matches || y <= COMPACT_AFTER) {
        last = y;
        setCompact(false);
        return;
      }
      if (Math.abs(delta) < 4) return;
      last = y;
      setCompact(delta > 0);
    };
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(measure);
    };
    const onWide = () => setCompact(false);

    window.addEventListener("scroll", onScroll, { passive: true });
    wide.addEventListener("change", onWide);
    return () => {
      window.removeEventListener("scroll", onScroll);
      wide.removeEventListener("change", onWide);
    };
  }, []);

  return compact;
}

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
  const compact = useCompactHeader();
  const headerRef = useRef<HTMLElement>(null);
  /**
   * How much room the page keeps for the out-of-flow header. Measured from the
   * header while it is whole, and deliberately *not* remeasured once it
   * compacts: the reservation only matters at the top of the page, where the
   * header is always whole, and freezing it is what keeps a collapse from
   * changing the document's height (see useCompactHeader).
   */
  const [reserved, setReserved] = useState(0);

  useEffect(() => {
    const el = headerRef.current;
    if (!el || compact) return;
    const observer = new ResizeObserver(() => setReserved(el.offsetHeight));
    observer.observe(el);
    setReserved(el.offsetHeight);
    return () => observer.disconnect();
  }, [compact]);

  /**
   * The header's *live* height, for anything that has to sit below a fixed
   * header — the toasts, today. Distinct from `reserved` above, which freezes
   * at the expanded height on purpose: this one follows the collapse, or a
   * toast would hang in the gap the compact header left behind. Safe to track
   * live because it only moves a fixed-position element and so cannot change
   * the document's height (see useCompactHeader).
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
         * Pinned, and out of flow rather than sticky — the collapse depends on
         * it, see useCompactHeader. z-30 clears the page's own stacking (cards,
         * the library's own sticky filters) but sits below the top layer, so a
         * <dialog> or a popover still covers it rather than fighting it.
         */}
        <header
          ref={headerRef}
          className="fixed inset-x-0 top-0 z-30 bg-header text-header-ink"
          data-compact={compact}
        >
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
            <Nav compact={compact} />
            <span className="order-2 ml-auto sm:order-3 sm:ml-0">
              <UserMenu />
            </span>
          </div>
        </header>
        {/* The room the fixed header would have taken up in flow. */}
        <div aria-hidden="true" style={{ height: reserved }} />
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
