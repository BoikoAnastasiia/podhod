import { Link } from "@tanstack/react-router";
import type { DictKey } from "../i18n/useI18n.js";
import { useI18n } from "../i18n/useI18n.js";

/**
 * Every destination the top bar links to. Сегодня / Программы / История /
 * Прогресс are not routes yet (Phases 1b/2 add auth and programs) — they are
 * deliberately absent rather than linked to pages that 404, per the shell
 * brief. Adding one later is one entry here, not a redesign: this is the only
 * place a route list is spelled out.
 */
const NAV_ITEMS = [{ to: "/library", labelKey: "nav.library" }] as const satisfies {
  to: string;
  labelKey: DictKey;
}[];

/**
 * With a single destination, a plain text link next to the wordmark reads as
 * a nav bar missing its other tabs. Rather than drop the nav landmark (Phase
 * 1b's Today/Programs slot into NAV_ITEMS above with no structural change
 * here), this link is styled as a standalone, always-visible pill — a
 * deliberate shortcut, not a lonely tab — so it reads the same with one item
 * as it will with four.
 */
export function Nav() {
  const { t } = useI18n();
  return (
    <nav className="flex items-center gap-1" aria-label={t("nav.library")}>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className="flex min-h-tap-min items-center rounded-full border border-border bg-surface px-4 text-sm font-medium transition-colors duration-150 hover:bg-chip-hover hover:text-ink"
          activeProps={{ className: "border-transparent bg-chip-hover text-ink font-semibold" }}
          inactiveProps={{ className: "text-muted" }}
        >
          {t(item.labelKey)}
        </Link>
      ))}
    </nav>
  );
}
