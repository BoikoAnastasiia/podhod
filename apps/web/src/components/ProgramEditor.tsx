import { loadProfileOf, mediaUrl } from "@podhod/core";
import type { ProgramExercise, SchemeInput } from "@podhod/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useI18n } from "../i18n/useI18n.js";
import {
  addExercise,
  deleteExercise,
  fetchProgram,
  reorderExercises,
  updateExercise,
  updateProgram,
} from "../lib/api.js";
import { programKeys } from "../lib/programKeys.js";
import { ExercisePicker } from "./ExercisePicker.js";
import { CopyIcon, PencilIcon, XIcon } from "./icons.js";
import { IconPicker } from "./IconPicker.js";
import { moved, ReorderButtons } from "./ReorderButtons.js";
import { SCHEME_DEFAULTS, SchemeEditor } from "./SchemeEditor.js";
import { SchemeSummary } from "./SchemeSummary.js";
import { useToast } from "./Toast.js";

const pill =
  "flex min-h-tap-min items-center rounded-full border border-border bg-surface px-4 text-sm font-medium text-muted transition-colors duration-150 hover:bg-chip-hover hover:text-ink";

type FixedScheme = Extract<SchemeInput, { kind: "fixed" }>;

/**
 * Round icon buttons for the row's actions. The words "Edit scheme" and
 * "Remove" made every row a paragraph of controls wider than the exercise it
 * described; the glyphs carry the same two actions in a fraction of the width,
 * with the label moved to aria-label so nothing is lost to a screen reader.
 */
/**
 * The editor's own primary action, in ink rather than the accent. Lime already
 * carries "New program" on the list behind this dialog; a second lime button
 * inside it competed with the first for the same emphasis, on a different page.
 */
const primaryButton =
  "flex min-h-tap-min w-max items-center rounded-full bg-ink px-5 text-sm font-semibold text-canvas transition-opacity duration-150 hover:opacity-85";
const iconButton =
  "flex size-tap-min items-center justify-center rounded-full border border-border bg-surface text-muted transition-colors duration-150 hover:bg-chip-hover hover:text-ink";
const dangerIconButton =
  "flex size-tap-min items-center justify-center rounded-full border border-border bg-surface text-error transition-colors duration-150 hover:border-error";

/**
 * The weight, editable right on the row — the trainer's-sheet interaction:
 * the sheet says squat, 4×10, and the number you keep touching is the weight.
 * Commits on blur or Enter; an unparseable or unchanged value quietly reverts
 * rather than firing a doomed request. Only fixed schemes have a single
 * weight; the progression kinds render their summary instead.
 */
function WeightField({
  scheme,
  label,
  onSave,
}: {
  scheme: FixedScheme;
  label: string;
  onSave: (scheme: FixedScheme) => void;
}) {
  const [text, setText] = useState(String(scheme.weightKg));

  const commit = () => {
    const value = Number(text.trim());
    const valid = Number.isFinite(value) && value > 0 && value <= 1000;
    if (!valid) {
      setText(String(scheme.weightKg));
      return;
    }
    if (value !== scheme.weightKg) onSave({ ...scheme, weightKg: value });
  };

  return (
    <input
      type="number"
      inputMode="decimal"
      step="any"
      value={text}
      aria-label={label}
      data-testid="entry-weight"
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      className="min-h-tap-min w-20 rounded-row border border-border bg-surface px-2 text-ink tabular-nums"
    />
  );
}

/**
 * The whole program-building surface — title, icon, its exercises with their
 * weights — independent of where it is framed. The `$programId` route mounts
 * it as a page (mobile, deep links); the `/programs` list mounts the same
 * component inside a dialog on desktop. One editor, two shells, so the two
 * entrances cannot drift apart.
 *
 * A program IS one workout (phase 3d): exercises hang directly off it, and
 * adding one is a single tap that writes the default 4×10 fixed scheme — the
 * weight is then the field in front of you.
 */
export function ProgramEditor({ programId }: { programId: string }) {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [pickerOpen, setPickerOpen] = useState(false);
  /** Which entry's scheme is open in an editor, and which is one click from removal. */
  const [editingScheme, setEditingScheme] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null);
  /** The title mid-rename, or null when it is just a heading. */
  const [renaming, setRenaming] = useState<string | null>(null);

  const program = useQuery({
    queryKey: programKeys.detail(programId, lang),
    queryFn: () => fetchProgram(programId, lang),
  });

  /**
   * Invalidating `all` rather than just this detail key: adding or removing
   * an exercise changes the count the list screen shows, and a stale count
   * there after editing here is the kind of wrongness nobody reports and
   * everybody notices.
   */
  const invalidate = () => queryClient.invalidateQueries({ queryKey: programKeys.all });

  /**
   * A pick adds immediately with the default 4×10 — configuration never gates
   * creation. The panel stays open on purpose: adding five exercises in a row
   * is the common case, and the weight is editable right on the row.
   */
  const add = useMutation({
    /*
     * The exercise's name rides along purely so the toast can name it: the
     * picker already knows it, and the alternative — reading it back out of the
     * refetched program — would put the confirmation behind a round trip that
     * the user has no reason to wait for.
     */
    mutationFn: async (picked: { id: string; name: string; equipment: string; bodyPart: string }) => {
      /*
       * The default follows the equipment, not a constant. Every exercise used
       * to arrive as 4×10 · 20 kg, which for the 451 movements in this library
       * that carry no external load was a weight nobody lifts — most visibly
       * "walk elliptical cross trainer, 4×10 · 20 kg".
       */
      const { fallback } = loadProfileOf(picked.equipment, picked.bodyPart);
      await addExercise(programId, { exerciseId: picked.id, scheme: SCHEME_DEFAULTS[fallback] });
      return picked;
    },
    onSuccess: async (picked) => {
      toast(
        t("toast.exerciseAdded")
          .replace("{exercise}", picked.name)
          .replace("{program}", program.data?.name ?? ""),
      );
      await invalidate();
    },
  });

  /**
   * A second row for the same exercise, carrying the first one's prescription
   * as its starting point — the working set and its back-off set are one
   * exercise twice, and the copy is only useful if the weight is then changed.
   *
   * It lands directly beneath its original rather than at the end of the list,
   * which costs a second request: the add endpoint always appends, so the copy
   * is placed by sending the order we want. A duplicate that appears fourteen
   * rows below the thing it duplicates is not a duplicate anyone can use.
   */
  const duplicateEntry = useMutation({
    mutationFn: async (entry: ProgramExercise) => {
      const created = await addExercise(programId, {
        exerciseId: entry.exerciseId,
        scheme: entry.scheme,
        restSeconds: entry.restSeconds,
        notes: entry.notes,
      });
      if (!created) throw new Error("internal");

      const ids = entries.map((e) => e.id);
      const after = ids.indexOf(entry.id) + 1;
      await reorderExercises(programId, [...ids.slice(0, after), created, ...ids.slice(after)]);
      return entry;
    },
    onSuccess: async (entry) => {
      toast(
        t("toast.exerciseAdded")
          .replace("{exercise}", entry.name)
          .replace("{program}", program.data?.name ?? ""),
      );
      await invalidate();
    },
  });

  const updateEntry = useMutation({
    mutationFn: (input: { id: string; scheme: SchemeInput }) =>
      updateExercise(input.id, { scheme: input.scheme }),
    onSuccess: async () => {
      setEditingScheme(null);
      await invalidate();
    },
  });

  const removeEntry = useMutation({
    mutationFn: (id: string) => deleteExercise(id),
    onSuccess: async () => {
      setConfirmingRemove(null);
      await invalidate();
    },
  });

  const reorderEntries = useMutation({
    mutationFn: (ids: string[]) => reorderExercises(programId, ids),
    onSuccess: invalidate,
  });

  const rename = useMutation({
    mutationFn: (name: string) => updateProgram(programId, { name }),
    onSuccess: async () => {
      setRenaming(null);
      await invalidate();
    },
  });

  const entries = program.data?.exercises ?? [];

  const moveExercise = (from: number, to: number) => {
    // The API takes the complete ordered list and validates it against the
    // program's own entries before writing, so sending the whole thing is
    // both what it wants and what makes a replayed request harmless.
    const ids = moved(entries, from, to).map((entry) => entry.id);
    reorderEntries.mutate(ids);
  };

  const entryRow = (entry: ProgramExercise, index: number) => (
    <li
      key={entry.id}
      data-testid="day-exercise"
      data-entry-position={entry.position}
      className="rounded-row border border-border px-3 py-2 text-sm text-ink"
    >
      {/*
       * The actions never wrap; the name does. With everything wrapping, one
       * long exercise name pushed the whole control cluster onto a second line
       * and that row alone grew to twice the height of its neighbours.
       */}
      <div className="flex min-h-row-min items-center justify-between gap-2">
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {/*
           * The exercise itself, as a way in rather than only a picture: a
           * program row names a movement, and "what does that actually look
           * like" is a question you have while reading the row. It carries
           * `from` so the library page can offer the way back — see that
           * route's note on why the id travels in the URL instead of history.
           */}
          <Link
            to="/library/$id"
            params={{ id: entry.exerciseId }}
            search={{ from: programId }}
            data-testid="entry-preview"
            aria-label={t("entry.preview").replace("{name}", entry.name)}
            className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-row bg-canvas transition-shadow duration-200 ease-out hover:shadow-card-hover"
          >
            <img
              src={mediaUrl(entry.imagePath)}
              alt=""
              width={56}
              height={56}
              loading="lazy"
              className="size-full object-contain"
            />
          </Link>
          <span className="font-medium" data-testid="entry-name">
            {entry.name}
          </span>
          {entry.scheme.kind === "fixed" ? (
            <span className="flex items-center gap-1 text-muted tabular-nums">
              {entry.scheme.sets}×{entry.scheme.reps} ·
              <WeightField
                key={`${entry.id}:${entry.scheme.weightKg}`}
                scheme={entry.scheme}
                label={t("scheme.field.weightKg")}
                onSave={(scheme) => updateEntry.mutate({ id: entry.id, scheme })}
              />
              {t("scheme.unit.kg")}
            </span>
          ) : (
            <SchemeSummary scheme={entry.scheme} />
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <ReorderButtons
            index={index}
            count={entries.length}
            upLabel={t("entry.moveUp").replace("{name}", entry.name)}
            downLabel={t("entry.moveDown").replace("{name}", entry.name)}
            onMove={moveExercise}
          />
          <button
            type="button"
            className={iconButton}
            data-testid="edit-entry"
            aria-label={t("entry.edit")}
            aria-expanded={editingScheme === entry.id}
            onClick={() => setEditingScheme(editingScheme === entry.id ? null : entry.id)}
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            className={iconButton}
            data-testid="duplicate-entry"
            aria-label={t("entry.duplicate").replace("{name}", entry.name)}
            disabled={duplicateEntry.isPending}
            onClick={() => duplicateEntry.mutate(entry)}
          >
            <CopyIcon />
          </button>
          {confirmingRemove === entry.id ? (
            <>
              <button
                type="button"
                className={`${pill} border-error text-error`}
                data-testid="confirm-remove-entry"
                onClick={() => removeEntry.mutate(entry.id)}
              >
                {t("entry.remove.confirm")}
              </button>
              <button
                type="button"
                className={pill}
                onClick={() => setConfirmingRemove(null)}
              >
                {t("entry.cancel")}
              </button>
            </>
          ) : (
            <button
              type="button"
              className={dangerIconButton}
              data-testid="remove-entry"
              aria-label={t("entry.remove")}
              onClick={() => setConfirmingRemove(entry.id)}
            >
              <XIcon />
            </button>
          )}
        </span>
      </div>

      {editingScheme === entry.id && (
        <div className="mt-3 border-t border-border pt-3">
          {updateEntry.isError && (
            <p role="alert" className="mb-2 text-sm text-error">
              {t("entry.updateFailed")}
            </p>
          )}
          <SchemeEditor
            kinds={loadProfileOf(entry.equipment, entry.bodyPart).allowed}
            initial={entry.scheme}
            submitLabel={t("entry.save")}
            pending={updateEntry.isPending}
            onSubmit={(scheme) => updateEntry.mutate({ id: entry.id, scheme })}
            onCancel={() => setEditingScheme(null)}
          />
        </div>
      )}
    </li>
  );

  return (
    <>
      {program.isPending && <p className="mt-6 text-muted">{t("programs.loading")}</p>}
      {program.isError && <p className="mt-6 text-muted">{t("programs.error")}</p>}

      {program.isSuccess && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <IconPicker
              programId={programId}
              icon={program.data.icon}
              iconColor={program.data.iconColor}
            />
            {renaming !== null ? (
              <form
                className="flex flex-1 flex-wrap items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const name = renaming.trim();
                  if (name.length > 0) rename.mutate(name);
                }}
              >
                <input
                  value={renaming}
                  onChange={(event) => setRenaming(event.target.value)}
                  data-testid="program-name-input"
                  maxLength={80}
                  // eslint-disable-next-line jsx-a11y/no-autofocus -- the field
                  // replaces the control that was just clicked; leaving focus on
                  // a button that no longer exists strands keyboard users.
                  autoFocus
                  className="min-h-tap-min flex-1 rounded-row border border-border bg-surface px-3 text-xl font-semibold text-ink"
                />
                <button type="submit" className={pill} data-testid="save-program-name">
                  {t("programs.save")}
                </button>
                <button type="button" className={pill} onClick={() => setRenaming(null)}>
                  {t("entry.cancel")}
                </button>
              </form>
            ) : (
              <>
                <h1 className="text-2xl font-semibold text-ink" data-testid="program-title">
                  {program.data.name}
                </h1>
                <button
                  type="button"
                  data-testid="rename-program"
                  aria-label={t("programs.rename")}
                  onClick={() => setRenaming(program.data.name)}
                  className="flex size-tap-min items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-chip-hover hover:text-ink"
                >
                  <PencilIcon />
                </button>
              </>
            )}
          </div>

          {entries.length === 0 ? (
            <div className="mt-8" data-testid="entries-empty">
              <p className="text-muted">{t("entries.empty")}</p>
              <p className="mt-1 text-sm text-muted">{t("entries.emptyHint")}</p>
            </div>
          ) : (
            <ul className="mt-6 flex flex-col gap-2">{entries.map(entryRow)}</ul>
          )}

          {!pickerOpen && (
            <button
              type="button"
              className={`${primaryButton} mt-4`}
              data-testid="add-exercise"
              onClick={() => setPickerOpen(true)}
            >
              {t("picker.add")}
            </button>
          )}

          {pickerOpen && (
            <>
              {add.isError && (
                <p role="alert" className="mt-4 text-sm text-error">
                  {t("picker.failed")}
                </p>
              )}
              <ExercisePicker
                addedIds={new Set(entries.map((entry) => entry.exerciseId))}
                onPick={(exercise) =>
                  add.mutate({
                    id: exercise.id,
                    name: exercise.name,
                    equipment: exercise.equipment,
                    bodyPart: exercise.bodyPart,
                  })
                }
                onClose={() => setPickerOpen(false)}
              />
            </>
          )}
        </>
      )}
    </>
  );
}
