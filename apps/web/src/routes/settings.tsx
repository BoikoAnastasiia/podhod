import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useI18n } from "../i18n/useI18n.js";
import { fetchMe } from "../lib/api.js";
import { requireSession } from "../lib/requireSession.js";

/**
 * The one route this phase gates — a real page, not a stub, so the guard
 * mechanism (`beforeLoad` + `requireSession`, see that module) is proven
 * against actual session/no-session behaviour rather than a route that
 * would gate the same way whether or not the check worked. A full editor
 * for these fields is later work (docs/design.md's `/settings` screen);
 * this reads back what `user_settings` already holds.
 */
export const Route = createFileRoute("/settings")({
  beforeLoad: ({ location }) => requireSession(location.href),
  component: Settings,
});

function Settings() {
  const { t } = useI18n();
  const { data, isPending, isError } = useQuery({ queryKey: ["me"], queryFn: fetchMe });

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
    </div>
  );
}
