import type { ProgramDay } from "@podhod/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useI18n } from "../i18n/useI18n.js";
import { deleteDay, updateDay } from "../lib/api.js";
import { programKeys } from "../lib/programKeys.js";
import { ReorderButtons } from "./ReorderButtons.js";

const pill =
  "flex min-h-tap-min items-center rounded-full border border-border bg-surface px-4 text-sm font-medium text-muted transition-colors duration-150 hover:bg-chip-hover hover:text-ink";

/**
 * One day's card: rename, delete, reorder, and its exercises. Split out of the
 * programs/$programId route because each day carries its own editing state —
 * two days in mid-rename must not share a field.
 *
 * Reordering stays with the parent: moving a day rewrites its *siblings'*
 * positions, which this component cannot see.
 */
export function DayEditor({
  day,
  index,
  count,
  onMove,
}: {
  day: ProgramDay;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  /**
   * Invalidating `all` rather than just the program's detail key: adding or
   * removing a day changes the day count the list screen shows, and a stale
   * count there after editing here is the kind of wrongness nobody reports
   * and everybody notices.
   */
  const invalidate = () => queryClient.invalidateQueries({ queryKey: programKeys.all });

  const renameDay = useMutation({
    mutationFn: (name: string) => updateDay(day.id, name),
    onSuccess: async () => {
      setRenaming(null);
      await invalidate();
    },
  });

  const removeDay = useMutation({
    mutationFn: () => deleteDay(day.id),
    onSuccess: invalidate,
  });

  return (
    <li
      data-testid="day-card"
      data-day-position={day.position}
      className="rounded-card border border-border bg-surface p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {renaming !== null ? (
          <form
            className="flex flex-1 flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const name = renaming.trim();
              if (name.length > 0) renameDay.mutate(name);
            }}
          >
            <input
              value={renaming}
              onChange={(event) => setRenaming(event.target.value)}
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
                count={count}
                upLabel={t("days.moveUp").replace("{name}", day.name)}
                downLabel={t("days.moveDown").replace("{name}", day.name)}
                onMove={onMove}
              />
              <button
                type="button"
                className={pill}
                data-testid="rename-day"
                onClick={() => setRenaming(day.name)}
              >
                {t("days.rename")}
              </button>
              {confirmingDelete ? (
                <>
                  <button
                    type="button"
                    className={`${pill} border-error text-error`}
                    data-testid="confirm-delete-day"
                    onClick={() => removeDay.mutate()}
                  >
                    {t("days.delete.confirm")}
                  </button>
                  <button
                    type="button"
                    className={pill}
                    onClick={() => setConfirmingDelete(false)}
                  >
                    {t("days.cancel")}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={pill}
                  data-testid="delete-day"
                  onClick={() => setConfirmingDelete(true)}
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
}
