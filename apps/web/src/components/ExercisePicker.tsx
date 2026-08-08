import type { ExerciseListItem } from "@podhod/schema";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useI18n } from "../i18n/useI18n.js";
import { fetchExercises } from "../lib/api.js";
import { BODY_PARTS } from "../lib/bodyParts.js";
import { FilterChips } from "./FilterChips.js";

const pill =
  "flex min-h-tap-min items-center rounded-full border border-border bg-surface px-4 text-sm font-medium text-muted transition-colors duration-150 hover:bg-chip-hover hover:text-ink";

/**
 * An inline panel rather than a modal dialog. A modal needs a focus trap,
 * scroll locking, an Escape handler and an accessible name to be correct, and
 * gets those wrong quietly; a panel that expands in place needs none of it and
 * loses nothing here, since picking an exercise is not an interruption of
 * something else — it is the task.
 *
 * Search works the way the library's own does — the query key carries the
 * text, so every keystroke is a fresh cached query. Results are capped rather
 * than paginated: this is a picker, and someone who cannot find an exercise
 * in the first twenty should refine the search instead of scrolling 1,324
 * rows.
 */
const PICKER_LIMIT = 20;

export function ExercisePicker({
  onPick,
  onClose,
}: {
  onPick: (exercise: ExerciseListItem) => void;
  onClose: () => void;
}) {
  const { lang, t, term } = useI18n();
  const [q, setQ] = useState("");
  const [bodyPart, setBodyPart] = useState<string | undefined>();

  const results = useQuery({
    queryKey: ["exercises", "picker", lang, q, bodyPart],
    queryFn: () => fetchExercises({ lang, q, bodyPart, limit: PICKER_LIMIT }),
  });

  return (
    <div className="mt-4 rounded-row border border-border p-4" data-testid="exercise-picker">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder={t("library.search")}
          aria-label={t("library.search")}
          data-testid="picker-search"
          // eslint-disable-next-line jsx-a11y/no-autofocus -- the panel opens
          // from the button that was just clicked, and the search field is the
          // only reason it exists; making the user click again is punishment.
          autoFocus
          className="min-h-tap-min flex-1 rounded-row border border-border bg-surface px-4 text-ink"
        />
        <button type="button" className={pill} data-testid="picker-close" onClick={onClose}>
          {t("picker.close")}
        </button>
      </div>

      <p className="mt-2 text-xs text-muted">{t("picker.hint")}</p>

      {/* The same ten body-part chips the library filters by. */}
      <div className="mt-3">
        <FilterChips
          options={BODY_PARTS}
          selected={bodyPart}
          onSelect={setBodyPart}
          label={term}
        />
      </div>

      {results.isPending && <p className="mt-3 text-sm text-muted">{t("library.loading")}</p>}
      {results.isError && <p className="mt-3 text-sm text-error">{t("library.error")}</p>}
      {results.isSuccess && results.data.items.length === 0 && (
        <p className="mt-3 text-sm text-muted">{t("library.empty")}</p>
      )}

      {results.isSuccess && results.data.items.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {results.data.items.map((exercise) => (
            <li key={exercise.id}>
              <button
                type="button"
                data-testid="picker-result"
                onClick={() => onPick(exercise)}
                className="flex min-h-row-min w-full flex-wrap items-center justify-between gap-2 rounded-row border border-border bg-surface px-3 text-left text-sm text-ink transition-colors duration-150 hover:bg-chip-hover"
              >
                <span className="font-medium">{exercise.name}</span>
                <span className="text-xs text-muted">
                  {term(exercise.bodyPart)} · {term(exercise.equipment)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
