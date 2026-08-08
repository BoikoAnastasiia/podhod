import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useI18n } from "../../i18n/useI18n.js";
import { fetchProgram } from "../../lib/api.js";
import { programKeys } from "../../lib/programKeys.js";
import { requireSession } from "../../lib/requireSession.js";

export const Route = createFileRoute("/programs/$programId")({
  beforeLoad: ({ location }) => requireSession(location.href),
  component: ProgramDetail,
});

function ProgramDetail() {
  const { programId } = Route.useParams();
  const { t, lang } = useI18n();

  const program = useQuery({
    queryKey: programKeys.detail(programId, lang),
    queryFn: () => fetchProgram(programId, lang),
  });

  return (
    <div className="mx-auto w-full max-w-content px-4 py-8">
      <Link to="/programs" className="text-sm text-muted underline-offset-4 hover:underline">
        {t("programs.heading")}
      </Link>

      {program.isPending && <p className="mt-6 text-muted">{t("programs.loading")}</p>}
      {program.isError && <p className="mt-6 text-muted">{t("programs.error")}</p>}

      {program.isSuccess && (
        <>
          <h1 className="mt-4 text-2xl font-semibold text-ink" data-testid="program-title">
            {program.data.name}
          </h1>

          {program.data.days.length === 0 && (
            <p className="mt-6 text-muted" data-testid="days-empty">
              {t("programs.dayCount.zero")}
            </p>
          )}

          <ul className="mt-6 flex flex-col gap-4">
            {program.data.days.map((day) => (
              <li
                key={day.id}
                data-testid="day-card"
                className="rounded-card border border-border bg-surface p-5"
              >
                <h2 className="font-semibold text-ink">{day.name}</h2>
                <ul className="mt-3 flex flex-col gap-2">
                  {day.exercises.map((entry) => (
                    <li key={entry.id} data-testid="day-exercise" className="text-sm text-ink">
                      {entry.name}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
