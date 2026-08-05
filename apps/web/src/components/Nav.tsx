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

export function Nav() {
  const { t } = useI18n();
  return (
    <nav className="flex items-center gap-1">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className="flex min-h-tap-min items-center rounded-full px-3 text-sm transition-colors duration-150 hover:bg-chip-hover hover:text-ink"
          activeProps={{ className: "text-ink font-semibold" }}
          inactiveProps={{ className: "text-muted" }}
        >
          {t(item.labelKey)}
        </Link>
      ))}
    </nav>
  );
}
