import { Link } from "@tanstack/react-router";
import type { DictKey } from "../i18n/useI18n.js";
import { useI18n } from "../i18n/useI18n.js";
import { authClient } from "../lib/authClient.js";
import { UserMenu } from "./UserMenu.js";

/**
 * Every destination the top bar links to. Adding one later is one entry
 * here, not a redesign: this is the only place a route list is spelled out.
 */
const NAV_ITEMS = [
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
    <nav className="flex flex-wrap items-center gap-x-5 gap-y-1" aria-label={t("menu.navLabel")}>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className={navLink}
          activeProps={{ className: "underline" }}
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
      <UserMenu />
    </nav>
  );
}
