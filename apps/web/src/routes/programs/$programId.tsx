import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { DayEditor } from "../../components/DayEditor.js";
import { moved } from "../../components/ReorderButtons.js";
import { useI18n } from "../../i18n/useI18n.js";
import { createDay, fetchProgram, reorderDays } from "../../lib/api.js";
import { programKeys } from "../../lib/programKeys.js";
import { requireSession } from "../../lib/requireSession.js";

export const Route = createFileRoute("/programs/$programId")({
  beforeLoad: ({ location }) => requireSession(location.href),
  component: ProgramDetail,
});

function ProgramDetail() {
  const { programId } = Route.useParams();
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();

  const [newDayName, setNewDayName] = useState("");

  const program = useQuery({
    queryKey: programKeys.detail(programId, lang),
    queryFn: () => fetchProgram(programId, lang),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: programKeys.all });

  const addDay = useMutation({
    mutationFn: (name: string) => createDay(programId, name),
    onSuccess: async () => {
      setNewDayName("");
      await invalidate();
    },
  });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => reorderDays(programId, ids),
    onSuccess: invalidate,
  });

  const days = program.data?.days ?? [];

  const moveDay = (from: number, to: number) => {
    // The API takes the complete ordered list and validates it against the
    // program's own days before writing, so sending the whole thing is both
    // what it wants and what makes a replayed request harmless.
    const ids = moved(days, from, to).map((d) => d.id);
    reorder.mutate(ids);
  };

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

          <form
            className="mt-6 flex flex-wrap items-center gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const name = newDayName.trim();
              if (name.length > 0) addDay.mutate(name);
            }}
          >
            <input
              value={newDayName}
              onChange={(event) => setNewDayName(event.target.value)}
              placeholder={t("days.name.placeholder")}
              data-testid="new-day-name"
              maxLength={80}
              className="min-h-tap-min flex-1 rounded-row border border-border bg-surface px-4 text-ink"
            />
            <button
              type="submit"
              data-testid="add-day"
              disabled={newDayName.trim().length === 0 || addDay.isPending}
              className="min-h-tap-min rounded-full bg-accent px-5 text-sm font-semibold text-ink-on-accent disabled:opacity-50"
            >
              {t("days.add")}
            </button>
          </form>

          {days.length === 0 ? (
            <p className="mt-8 text-muted" data-testid="days-empty">
              {t("programs.dayCount.zero")}
            </p>
          ) : (
            <ul className="mt-8 flex flex-col gap-4">
              {days.map((day, index) => (
                <DayEditor
                  key={day.id}
                  day={day}
                  index={index}
                  count={days.length}
                  onMove={moveDay}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
