import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/useI18n.js";
import { authClient } from "../lib/authClient.js";
import { useTheme } from "../lib/themeContext.js";

const segment = (active: boolean) =>
  active
    ? "min-h-tap-min flex-1 rounded-full bg-accent px-4 text-sm font-semibold text-ink-on-accent"
    : "min-h-tap-min flex-1 rounded-full px-4 text-sm text-muted transition-colors duration-150 hover:bg-chip-hover hover:text-ink";

/**
 * The metacritic-style account corner: one avatar button, one panel with
 * everything session-shaped in it — identity, the language toggle, sign out.
 * The avatar is Google's profile photo when the account has one (Better
 * Auth carries `user.image` through from the provider), the account's first
 * letter otherwise, and a neutral glyph for guests.
 *
 * The language control is a real two-state toggle: both options visible,
 * the active one filled. The old single button labelled with the *other*
 * language ("RU" while reading English) made people guess what clicking
 * would do — the owner called it confusing, and she was right.
 */
export function UserMenu() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const user = session?.user;
  const initial = (user?.name || user?.email || "").trim().charAt(0).toUpperCase();

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        data-testid="user-menu"
        aria-expanded={open}
        aria-label={t("menu.label")}
        onClick={() => setOpen(!open)}
        className="flex size-tap-min items-center justify-center overflow-hidden rounded-full border-2 border-border bg-surface text-base font-semibold text-ink"
      >
        {user?.image ? (
          // Google avatar URLs 403 with a referrer from an unknown origin.
          <img
            src={user.image}
            alt=""
            referrerPolicy="no-referrer"
            className="size-full object-cover"
          />
        ) : initial ? (
          <span aria-hidden="true">{initial}</span>
        ) : (
          // A neutral guest glyph, drawn rather than shipped as an asset.
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5 text-muted">
            <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>

      {open && (
        <div
          data-testid="user-menu-panel"
          className="absolute right-0 top-full z-10 mt-2 flex w-64 flex-col gap-4 rounded-card border border-border bg-surface p-4 text-ink shadow-card-hover"
        >
          {!isPending && user && (
            <div className="flex flex-col gap-1">
              {user.name && <p className="truncate text-sm font-semibold">{user.name}</p>}
              <p className="truncate text-sm text-muted" data-testid="nav-identity">
                {user.email}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t("menu.language")}
            </span>
            <div
              role="group"
              aria-label={t("menu.language")}
              data-testid="lang-toggle"
              className="flex rounded-full border border-border p-1"
            >
              <button
                type="button"
                aria-pressed={lang === "en"}
                data-testid="lang-en"
                onClick={() => setLang("en")}
                className={segment(lang === "en")}
              >
                EN
              </button>
              <button
                type="button"
                aria-pressed={lang === "ru"}
                data-testid="lang-ru"
                onClick={() => setLang("ru")}
                className={segment(lang === "ru")}
              >
                RU
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t("menu.theme")}
            </span>
            <div
              role="group"
              aria-label={t("menu.theme")}
              className="flex rounded-full border border-border p-1"
            >
              {(["system", "light", "dark"] as const).map((choice) => (
                <button
                  key={choice}
                  type="button"
                  aria-pressed={theme === choice}
                  data-testid={`theme-${choice}`}
                  onClick={() => setTheme(choice)}
                  className={segment(theme === choice)}
                >
                  {t(`theme.${choice}`)}
                </button>
              ))}
            </div>
          </div>

          {!isPending &&
            (user ? (
              <button
                type="button"
                data-testid="sign-out"
                onClick={async () => {
                  await authClient.signOut();
                  setOpen(false);
                  navigate({ to: "/" });
                }}
                // bg-ink, not literal black: ink flips to near-white in the
                // dark theme, so the button stays a contrast block on both
                // panel colours instead of disappearing into the dark one.
                className="flex min-h-tap-min w-full items-center justify-center rounded-full bg-ink px-4 text-sm font-semibold text-canvas transition-opacity duration-150 hover:opacity-85"
              >
                {t("auth.signOut")}
              </button>
            ) : (
              <button
                type="button"
                data-testid="menu-sign-in"
                onClick={() => {
                  setOpen(false);
                  navigate({ to: "/sign-in" });
                }}
                className="flex min-h-tap-min w-full items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-ink-on-accent"
              >
                {t("auth.signIn")}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
