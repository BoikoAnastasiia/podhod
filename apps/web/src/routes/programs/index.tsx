import type { ProgramSummary } from "@podhod/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { plural } from "../../i18n/plural.js";
import { useI18n } from "../../i18n/useI18n.js";
import { createProgram, deleteProgram, fetchPrograms, updateProgram } from "../../lib/api.js";
import { programKeys } from "../../lib/programKeys.js";
import { requireSession } from "../../lib/requireSession.js";

/**
 * The first screen that is not the library. Gated the same way `/settings` is
 * — `beforeLoad` runs the session check before anything renders, so a
 * signed-out visitor is redirected rather than shown a page that immediately
 * 401s.
 */
export const Route = createFileRoute("/programs/")({
  beforeLoad: ({ location }) => requireSession(location.href),
  component: Programs,
});

const dayNounForms = {
  en: { one: "day", other: "days" },
  ru: { one: "день", few: "дня", many: "дней" },
} as const;

const pill =
  "flex min-h-tap-min items-center rounded-full border border-border bg-surface px-4 text-sm font-medium text-muted transition-colors duration-150 hover:bg-chip-hover hover:text-ink";

function Programs() {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [createError, setCreateError] = useState(false);
  /** Which program is one click from deletion. See the delete control below. */
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const programs = useQuery({ queryKey: programKeys.list(), queryFn: fetchPrograms });

  /**
   * Every mutation invalidates rather than patching the cache. Activating one
   * program deactivates another server-side, and archiving clears the active
   * flag — changes to rows the caller never named. A hand-patched cache would
   * have to reproduce those rules on the client, in a second place, from
   * memory.
   */
  const invalidate = () => queryClient.invalidateQueries({ queryKey: programKeys.all });

  const create = useMutation({
    mutationFn: (programName: string) => createProgram({ name: programName, notes: null }),
    onSuccess: async () => {
      setName("");
      setCreateError(false);
      await invalidate();
    },
    onError: () => setCreateError(true),
  });

  const update = useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof updateProgram>[1] }) =>
      updateProgram(input.id, input.patch),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteProgram(id),
    onSuccess: async () => {
      setConfirmingDelete(null);
      await invalidate();
    },
  });

  const all = programs.data?.programs ?? [];
  const live = all.filter((p) => p.archivedAt === null);
  const archived = all.filter((p) => p.archivedAt !== null);

  const dayCountLabel = (program: ProgramSummary) =>
    program.dayCount === 0
      ? t("programs.dayCount.zero")
      : `${program.dayCount} ${plural(lang, program.dayCount, dayNounForms[lang])}`;

  const card = (program: ProgramSummary) => (
    <li
      key={program.id}
      data-testid="program-card"
      data-program-active={program.isActive}
      className="rounded-card border border-border bg-surface p-5"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/programs/$programId"
          params={{ programId: program.id }}
          className="text-lg font-semibold text-ink underline-offset-4 hover:underline"
          data-testid="program-link"
        >
          {program.name}
        </Link>
        {program.isActive && (
          <span
            data-testid="active-badge"
            className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-ink-on-accent"
          >
            {t("programs.active")}
          </span>
        )}
        <span className="text-sm text-muted tabular-nums">{dayCountLabel(program)}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={pill}
          data-testid="toggle-active"
          onClick={() =>
            update.mutate({ id: program.id, patch: { isActive: !program.isActive } })
          }
        >
          {program.isActive ? t("programs.deactivate") : t("programs.activate")}
        </button>

        <button
          type="button"
          className={pill}
          data-testid="toggle-archive"
          onClick={() =>
            update.mutate({ id: program.id, patch: { archived: program.archivedAt === null } })
          }
        >
          {program.archivedAt === null ? t("programs.archive") : t("programs.unarchive")}
        </button>

        {/*
          Deleting is irreversible and sits beside archiving, which is not —
          and at a glance the two read almost identically. So the control asks
          first: one click changes its own label, a second confirms. Not a
          window.confirm, which blocks the event loop and can be neither styled
          nor translated.
        */}
        {confirmingDelete === program.id ? (
          <>
            <button
              type="button"
              className={`${pill} border-error text-error`}
              data-testid="confirm-delete"
              onClick={() => remove.mutate(program.id)}
            >
              {t("programs.delete.confirm")}
            </button>
            <button
              type="button"
              className={pill}
              data-testid="cancel-delete"
              onClick={() => setConfirmingDelete(null)}
            >
              {t("programs.delete.cancel")}
            </button>
          </>
        ) : (
          <button
            type="button"
            className={pill}
            data-testid="delete-program"
            onClick={() => setConfirmingDelete(program.id)}
          >
            {t("programs.delete")}
          </button>
        )}
      </div>
    </li>
  );

  return (
    <div className="mx-auto w-full max-w-content px-4 py-8">
      <h1 className="text-2xl font-semibold text-ink">{t("programs.heading")}</h1>

      <form
        className="mt-6 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = name.trim();
          if (trimmed.length > 0) create.mutate(trimmed);
        }}
      >
        <label className="flex-1">
          <span className="block text-sm font-medium text-muted">
            {t("programs.create.label")}
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("programs.create.placeholder")}
            data-testid="program-name"
            maxLength={80}
            className="mt-1 min-h-tap-min w-full rounded-row border border-border bg-surface px-4 text-ink"
          />
        </label>
        <button
          type="submit"
          data-testid="create-program"
          // Trimmed, because a name of spaces passes a length check and the
          // server rejects it — a disabled button explains that before the
          // round trip does.
          disabled={name.trim().length === 0 || create.isPending}
          className="min-h-tap-min rounded-full bg-accent px-5 text-sm font-semibold text-ink-on-accent disabled:opacity-50"
        >
          {t("programs.create.submit")}
        </button>
      </form>
      {createError && (
        <p role="alert" className="mt-2 text-sm text-error">
          {t("programs.create.failed")}
        </p>
      )}

      {programs.isPending && <p className="mt-8 text-muted">{t("programs.loading")}</p>}

      {programs.isError && (
        <div className="mt-8">
          <p className="text-muted">{t("programs.error")}</p>
          <button type="button" className={`${pill} mt-3`} onClick={() => programs.refetch()}>
            {t("programs.retry")}
          </button>
        </div>
      )}

      {programs.isSuccess && all.length === 0 && (
        // A new account lands here with nothing. An empty list under a bare
        // heading is the worst first impression the app can make, so this
        // explains what a program is rather than just stating there are none.
        <div className="mt-8 rounded-card border border-border bg-surface p-6" data-testid="programs-empty">
          <h2 className="text-lg font-semibold text-ink">{t("programs.empty.title")}</h2>
          <p className="mt-2 text-muted">{t("programs.empty.body")}</p>
        </div>
      )}

      {live.length > 0 && <ul className="mt-8 flex flex-col gap-4">{live.map(card)}</ul>}

      {archived.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            {t("programs.archived.heading")}
          </h2>
          <ul className="mt-4 flex flex-col gap-4">{archived.map(card)}</ul>
        </section>
      )}
    </div>
  );
}
