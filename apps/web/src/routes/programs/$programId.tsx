import type { ProgramDay } from "@podhod/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { moved, ReorderButtons } from "../../components/ReorderButtons.js";
import { useI18n } from "../../i18n/useI18n.js";
import { createDay, deleteDay, fetchProgram, reorderDays, updateDay } from "../../lib/api.js";
import { programKeys } from "../../lib/programKeys.js";
import { requireSession } from "../../lib/requireSession.js";

export const Route = createFileRoute("/programs/$programId")({
  beforeLoad: ({ location }) => requireSession(location.href),
  component: ProgramDetail,
});

const pill =
  "flex min-h-tap-min items-center rounded-full border border-border bg-surface px-4 text-sm font-medium text-muted transition-colors duration-150 hover:bg-chip-hover hover:text-ink";

function ProgramDetail() {
  const { programId } = Route.useParams();
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();

  const [newDayName, setNewDayName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const program = useQuery({
    queryKey: programKeys.detail(programId, lang),
    queryFn: () => fetchProgram(programId, lang),
  });

  /**
   * Invalidating `all` rather than just this detail key: adding or removing a
   * day changes the day count the list screen shows, and a stale count there
   * after editing here is the kind of wrongness nobody reports and everybody
   * notices.
   */
  const invalidate = () => queryClient.invalidateQueries({ queryKey: programKeys.all });

  const addDay = useMutation({
    mutationFn: (name: string) => createDay(programId, name),
    onSuccess: async () => {
      setNewDayName("");
      await invalidate();
    },
  });

  const renameDay = useMutation({
    mutationFn: (input: { id: string; name: string }) => updateDay(input.id, input.name),
    onSuccess: async () => {
      setRenaming(null);
      await invalidate();
    },
  });

  const removeDay = useMutation({
    mutationFn: (id: string) => deleteDay(id),
    onSuccess: async () => {
      setConfirmingDelete(null);
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

  const dayCard = (day: ProgramDay, index: number) => (
    <li
      key={day.id}
      data-testid="day-card"
      data-day-position={day.position}
      className="rounded-card border border-border bg-surface p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {renaming?.id === day.id ? (
          <form
            className="flex flex-1 flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const name = renaming.name.trim();
              if (name.length > 0) renameDay.mutate({ id: day.id, name });
            }}
          >
            <input
              value={renaming.name}
              onChange={(event) => setRenaming({ id: day.id, name: event.target.value })}
              data-testid="day-name-input"
              maxLength={80}
              // eslint-disable-next-line jsx-a11y/no-autofocus -- the field
              // replaces the control that was just clicked; leaving focus on a
              // button that no longer exists strands keyboard users.
              autoFocus
              className="min-h-tap-min flex-1 rounded-row border border-border bg-surface px-3 text-ink"
            />
            <button type="submit" className={pill} data-testid="save-day-name">
              {t("days.save")}
            </button>
            <button type="button" className={pill} onClick={() => setRenaming(null)}>
              {t("days.cancel")}
            </button>
          </form>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-ink" data-testid="day-name">
              {day.name}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <ReorderButtons
                index={index}
                count={days.length}
                upLabel={t("days.moveUp").replace("{name}", day.name)}
                downLabel={t("days.moveDown").replace("{name}", day.name)}
                onMove={moveDay}
              />
              <button
                type="button"
                className={pill}
                data-testid="rename-day"
                onClick={() => setRenaming({ id: day.id, name: day.name })}
              >
                {t("days.rename")}
              </button>
              {confirmingDelete === day.id ? (
                <>
                  <button
                    type="button"
                    className={`${pill} border-error text-error`}
                    data-testid="confirm-delete-day"
                    onClick={() => removeDay.mutate(day.id)}
                  >
                    {t("days.delete.confirm")}
                  </button>
                  <button
                    type="button"
                    className={pill}
                    onClick={() => setConfirmingDelete(null)}
                  >
                    {t("days.cancel")}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={pill}
                  data-testid="delete-day"
                  onClick={() => setConfirmingDelete(day.id)}
                >
                  {t("days.delete")}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {day.exercises.length === 0 ? (
        <p className="mt-4 text-sm text-muted" data-testid="day-empty">
          {t("days.empty")}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {day.exercises.map((entry) => (
            <li
              key={entry.id}
              data-testid="day-exercise"
              className="flex min-h-row-min items-center gap-3 rounded-row border border-border px-3 text-sm text-ink"
            >
              {entry.name}
            </li>
          ))}
        </ul>
      )}
    </li>
  );

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
            <ul className="mt-8 flex flex-col gap-4">{days.map(dayCard)}</ul>
          )}
        </>
      )}
    </div>
  );
}
