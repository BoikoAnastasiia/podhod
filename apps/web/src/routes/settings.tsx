import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import type { DictKey } from "../i18n/useI18n.js";
import { useI18n } from "../i18n/useI18n.js";
import { fetchMe } from "../lib/api.js";
import { authClient } from "../lib/authClient.js";
import { oauthErrorMessage } from "../lib/oauthErrors.js";
import { requireSession } from "../lib/requireSession.js";

type SettingsSearch = { error?: string };

/**
 * The one route this phase gates — a real page, not a stub, so the guard
 * mechanism (`beforeLoad` + `requireSession`, see that module) is proven
 * against actual session/no-session behaviour rather than a route that
 * would gate the same way whether or not the check worked. A full editor
 * for these fields is later work (docs/design.md's `/settings` screen);
 * this reads back what `user_settings` already holds.
 *
 * `error` on the search type: Better Auth's manual link-social flow
 * (below) redirects back here with `?error=<code>` when linking Google
 * fails — see lib/oauthErrors.ts, shared with sign-in.tsx/sign-up.tsx's
 * identical pattern for the sign-in-time equivalent.
 */
export const Route = createFileRoute("/settings")({
  beforeLoad: ({ location }) => requireSession(location.href),
  validateSearch: (search: Record<string, unknown>): SettingsSearch => ({
    error: typeof search["error"] === "string" ? search["error"] : undefined,
  }),
  component: Settings,
});

type Account = { id: string; providerId: string };

/**
 * The only two provider ids this app ever creates an `account` row for
 * (see apps/api/src/db/auth-schema.ts and auth.ts's socialProviders) — an
 * unrecognised id falls back to showing the raw id rather than a missing
 * translation, since a third provider would mean this map fell out of date,
 * not that the account doesn't exist.
 */
const METHOD_LABELS: Record<string, DictKey> = {
  credential: "settings.method.credential",
  google: "settings.method.google",
};

function Settings() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { error: linkErrorCode } = Route.useSearch();
  const { data, isPending, isError } = useQuery({ queryKey: ["me"], queryFn: fetchMe });

  const accountsQuery = useQuery({
    queryKey: ["accounts"],
    queryFn: async (): Promise<Account[]> => {
      const { data: accounts, error } = await authClient.listAccounts();
      if (error) throw new Error(error.code ?? "unknown");
      return accounts ?? [];
    },
  });

  const [linkPending, setLinkPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [unlinkPending, setUnlinkPending] = useState<string | null>(null);

  const accounts = accountsQuery.data ?? [];
  const hasGoogle = accounts.some((a) => a.providerId === "google");
  // Better Auth's own `/unlink-account` endpoint already refuses to remove
  // an account's last remaining sign-in method (accountLinking.
  // allowUnlinkingAll defaults to false — see auth.ts) and this repeats the
  // same rule client-side so the control never appears where the server
  // would reject it anyway, rather than surfacing that rejection as a
  // confusing runtime error after the click.
  const canUnlink = accounts.length > 1;

  // A failed OAuth redirect back from Google (query param) takes priority
  // over a stale local error from an earlier action in the same visit.
  const bannerMessage = oauthErrorMessage(linkErrorCode, t) ?? actionError;

  const linkGoogle = async () => {
    setActionError(null);
    setLinkPending(true);
    const { error } = await authClient.linkSocial({
      provider: "google",
      callbackURL: "/settings",
      errorCallbackURL: "/settings",
    });
    // A successful call navigates the browser away to Google before this
    // line would run, exactly like GoogleAuthButton's own flow — reaching
    // it means the request itself failed (network error, misconfigured
    // client), not that linking was refused. A refusal comes back later as
    // `?error=<code>` on the redirect back to this page, read above.
    setLinkPending(false);
    if (error) setActionError(t("auth.error.generic"));
  };

  const unlink = async (providerId: string) => {
    setActionError(null);
    setUnlinkPending(providerId);
    const { error } = await authClient.unlinkAccount({ providerId });
    setUnlinkPending(null);
    if (error) {
      setActionError(t("auth.error.generic"));
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["accounts"] });
  };

  return (
    <div className="flex flex-col gap-6 py-8">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("settings.title")}</h1>
      <div className="flex flex-col gap-4 rounded-card bg-surface p-6 shadow-card">
        {isPending && <p className="text-muted">{t("settings.loading")}</p>}
        {isError && <p className="text-error">{t("library.error")}</p>}
        {data && (
          <dl className="flex flex-col gap-3" data-testid="settings-data">
            <div className="flex flex-col gap-1 border-b border-border pb-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                {t("settings.account")}
              </dt>
              <dd className="text-ink">{data.user.email}</dd>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted">locale</dt>
                <dd className="tabular-nums text-ink">{data.settings.locale}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">units</dt>
                <dd className="tabular-nums text-ink">{data.settings.units}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">plate_increment_kg</dt>
                <dd className="tabular-nums text-ink">{data.settings.plateIncrementKg}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">default_rest_seconds</dt>
                <dd className="tabular-nums text-ink">{data.settings.defaultRestSeconds}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">theme</dt>
                <dd className="tabular-nums text-ink">{data.settings.theme}</dd>
              </div>
            </div>
          </dl>
        )}
      </div>

      <div
        className="flex flex-col gap-4 rounded-card bg-surface p-6 shadow-card"
        data-testid="settings-methods"
      >
        <h2 className="text-lg font-semibold text-ink">{t("settings.methods.title")}</h2>
        {bannerMessage && (
          <p className="text-error" data-testid="settings-methods-error">
            {bannerMessage}
          </p>
        )}
        {accountsQuery.isPending && <p className="text-muted">{t("settings.loading")}</p>}
        {accountsQuery.isError && <p className="text-error">{t("auth.error.generic")}</p>}
        {accountsQuery.data && (
          <ul className="flex flex-col gap-2">
            {accounts.map((account) => {
              const labelKey = METHOD_LABELS[account.providerId];
              return (
                <li
                  key={account.id}
                  data-testid={`method-${account.providerId}`}
                  className="flex min-h-tap-min items-center justify-between gap-3 rounded-row border border-border px-4"
                >
                  <span className="text-ink">{labelKey ? t(labelKey) : account.providerId}</span>
                  {canUnlink && (
                    <button
                      type="button"
                      data-testid={`unlink-${account.providerId}`}
                      disabled={unlinkPending === account.providerId}
                      onClick={() => unlink(account.providerId)}
                      className="min-h-tap-min rounded-full border border-border px-4 text-sm text-error transition-colors duration-150 hover:bg-chip-hover"
                    >
                      {unlinkPending === account.providerId
                        ? t("settings.unlinking")
                        : t("settings.unlink")}
                    </button>
                  )}
                </li>
              );
            })}
            {!hasGoogle && (
              <li className="flex min-h-tap-min items-center justify-between gap-3 rounded-row border border-dashed border-border px-4">
                <span className="text-muted">{t("settings.method.google")}</span>
                <button
                  type="button"
                  data-testid="link-google"
                  disabled={linkPending}
                  onClick={linkGoogle}
                  className="min-h-tap-min rounded-full border-2 border-border bg-surface px-4 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-chip-hover disabled:opacity-60"
                >
                  {linkPending ? t("auth.submitting") : t("settings.linkGoogle")}
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
