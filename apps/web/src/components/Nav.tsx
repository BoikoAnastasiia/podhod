import { Link } from "@tanstack/react-router";
import type { DictKey } from "../i18n/useI18n.js";
import { useI18n } from "../i18n/useI18n.js";
import { authClient } from "../lib/authClient.js";

/**
 * Every destination the top bar links to. Adding one later is one entry
 * here, not a redesign: this is the only place a route list is spelled out.
 */
const NAV_ITEMS = [
  { to: "/", labelKey: "nav.home" },
  { to: "/library", labelKey: "nav.library" },
  { to: "/blog", labelKey: "nav.blog" },
] as const satisfies {
  to: string;
  labelKey: DictKey;
}[];

/**
 * Destinations that only exist for a signed-in visitor. Kept apart from
 * NAV_ITEMS rather than filtered out of it, because "public" and "requires a
 * session" is exactly the distinction the library route depends on staying
 * explicit — the library is public by design and must never drift into this
 * list.
 */
const SESSION_NAV_ITEMS = [{ to: "/programs", labelKey: "nav.programs" }] as const satisfies {
  to: string;
  labelKey: DictKey;
}[];

/**
 * Bold text links, not pills: on the black band the affordance is the lime
 * underline on hover — lime on near-black measures ~16:1, so here (unlike on
 * light surfaces, see theme.css's link-inline warning) the accent is
 * genuinely legible. The active route keeps its underline.
 */
const navLink =
  "flex min-h-tap-min items-center text-sm font-semibold text-header-ink decoration-accent decoration-2 underline-offset-4 hover:underline";

export function Nav() {
  const { t } = useI18n();
  const { data: session, isPending } = authClient.useSession();

  return (
    /*
     * Ordered by the root header: on narrow viewports this nav wraps to its
     * own full-width second row (order-3 w-full) while the avatar stays up
     * beside the wordmark; from sm it slots back between wordmark and
     * avatar as a right-hand group (sm:ml-auto).
     */
    <nav
      className="order-3 flex w-full flex-wrap items-center gap-x-5 gap-y-1 sm:order-2 sm:ml-auto sm:w-auto"
      aria-label={t("menu.navLabel")}
    >
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className={navLink}
          activeProps={{ className: "underline" }}
          // Without exact matching, "/" counts as active on every route and
          // Home would be permanently underlined.
          activeOptions={{ exact: item.to === "/" }}
        >
          {t(item.labelKey)}
        </Link>
      ))}
      {!isPending &&
        session &&
        SESSION_NAV_ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={navLink}
            activeProps={{ className: "underline" }}
          >
            {t(item.labelKey)}
          </Link>
        ))}
      {!isPending && !session && (
        <Link
          to="/sign-in"
          data-testid="sign-in-link"
          className="flex min-h-tap-min items-center rounded-full bg-accent px-4 text-sm font-semibold text-ink-on-accent"
        >
          {t("auth.signIn")}
        </Link>
      )}
    </nav>
  );
}
