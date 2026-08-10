import type { ProgramSummary } from "@podhod/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ProgramEditor } from "../../components/ProgramEditor.js";
import {
  PROGRAM_TEMPLATES,
  type ProgramTemplate,
} from "../../data/programTemplates.js";
import { exerciseNounForms } from "../../i18n/dict.js";
import { plural } from "../../i18n/plural.js";
import { useI18n } from "../../i18n/useI18n.js";
import { createProgram, deleteProgram, fetchPrograms, updateProgram } from "../../lib/api.js";
import { materializeTemplate } from "../../lib/materializeTemplate.js";
import { programKeys } from "../../lib/programKeys.js";
import { requireSession } from "../../lib/requireSession.js";

/**
 * The first screen that is not the library. Gated the same way `/settings` is
 * — `beforeLoad` runs the session check before anything renders, so a
 * signed-out visitor is redirected rather than shown a page that immediately
 * 401s.
 */
export const Route = createFileRoute("/programs/")({
  /**
   * `?program=<id>` is the desktop dialog's state, kept in the URL so refresh
   * and Back restore the open editor, and a shared link opens the right one.
   */
  validateSearch: (search: Record<string, unknown>): { program?: string } =>
    typeof search.program === "string" && search.program.length > 0
      ? { program: search.program }
      : {},
  beforeLoad: ({ location }) => requireSession(location.href),
  component: Programs,
});

/** The sm breakpoint — below it the editor is a page, not a dialog. */
const DESKTOP = "(min-width: 40rem)";

const pill =
  "flex min-h-tap-min items-center rounded-full border border-border bg-surface px-4 text-sm font-medium text-muted transition-colors duration-150 hover:bg-chip-hover hover:text-ink";

/**
 * A native <dialog>, because the platform already solved what hand-rolled
 * modals get wrong: focus is trapped, Escape closes (firing `close`, which
 * clears the URL param via onClose), and ::backdrop needs no extra element.
 */
function ProgramDialog({ programId, onClose }: { programId: string; onClose: () => void }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      data-testid="program-dialog"
      onClose={onClose}
      className="m-auto max-h-dvh w-full max-w-content overflow-y-auto rounded-card border border-border bg-surface p-6 backdrop:bg-ink/50"
    >
      <div className="flex justify-end">
        <button
          type="button"
          className={pill}
          data-testid="close-program-dialog"
          onClick={() => ref.current?.close()}
        >
          {t("programs.close")}
        </button>
      </div>
      <ProgramEditor programId={programId} />
    </dialog>
  );
}

function Programs() {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { program: openProgramId } = Route.useSearch();
  const [search, setSearch] = useState("");

  // A dialog link opened on a phone forwards to the page shell — the same
  // editor, framed for the viewport it actually has.
  useEffect(() => {
    if (openProgramId && !window.matchMedia(DESKTOP).matches) {
      void navigate({
        to: "/programs/$programId",
        params: { programId: openProgramId },
        replace: true,
      });
    }
  }, [openProgramId, navigate]);

  const closeDialog = () => void navigate({ to: "/programs", search: {} });

  /**
   * The one opening rule: every way into a program — creating one, taking a
   * template, «Открыть» — lands in the editor, framed for the viewport.
   * Desktop stays on the list with the editor as a dialog; a phone gets the
   * full page, where a dialog would cram the whole builder into a keyhole.
   */
  const openProgram = (id: string) =>
    window.matchMedia(DESKTOP).matches
      ? void navigate({ to: "/programs", search: { program: id } })
      : void navigate({ to: "/programs/$programId", params: { programId: id } });
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

  /**
   * One click, no name form — the same inversion the rest of the app made:
   * creation is never gated on configuration. The program arrives as «Новая
   * программа», opens its editor immediately, and the title there is
   * click-to-rename for anyone who wants a real name.
   */
  const create = useMutation({
    mutationFn: () => createProgram({ name: t("programs.defaultName"), notes: null }),
    onSuccess: async (created) => {
      setCreateError(false);
      await invalidate();
      if (created) openProgram(created);
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

  /** Copies a template into the account, then opens the copy. */
  const take = useMutation({
    mutationFn: (template: ProgramTemplate) => materializeTemplate(template, lang),
    onSuccess: async (programId) => {
      await invalidate();
      openProgram(programId);
    },
  });

  /**
   * One search over everything with a title — the user's own programs and
   * the ready-made templates alike. Client-side: both lists are already in
   * memory, and a substring match is what "search by title" means here.
   */
  const q = search.trim().toLowerCase();
  const matches = (title: string) => q === "" || title.toLowerCase().includes(q);

  const all = programs.data?.programs ?? [];
  const live = all.filter((p) => p.archivedAt === null && matches(p.name));
  const archived = all.filter((p) => p.archivedAt !== null && matches(p.name));
  const visibleTemplates = PROGRAM_TEMPLATES.filter((tpl) => matches(tpl.name[lang]));
  const nothingMatches =
    q !== "" && live.length === 0 && archived.length === 0 && visibleTemplates.length === 0;

  const exerciseCountLabel = (program: ProgramSummary) =>
    program.exerciseCount === 0
      ? t("programs.exerciseCount.zero")
      : `${program.exerciseCount} ${plural(lang, program.exerciseCount, exerciseNounForms[lang])}`;

  const templateCard = (template: ProgramTemplate) => {
    const exerciseCount = template.exercises.length;
    const taking = take.isPending && take.variables?.id === template.id;
    return (
      <li
        key={template.id}
        data-testid="template-card"
        className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span aria-hidden="true" className="text-2xl">
            {template.icon}
          </span>
          <h3 className="text-lg font-semibold text-ink">{template.name[lang]}</h3>
        </div>
        <p className="text-sm text-muted">{template.description[lang]}</p>
        <div className="flex flex-wrap items-center gap-2">
          {template.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-chip-border bg-surface px-3 py-1 text-xs text-ink"
            >
              {t(`tags.${tag}`)}
            </span>
          ))}
          <span className="text-sm text-muted tabular-nums">
            {exerciseCount} {plural(lang, exerciseCount, exerciseNounForms[lang])}
          </span>
        </div>
        <button
          type="button"
          data-testid={`take-template-${template.id}`}
          disabled={take.isPending}
          onClick={() => take.mutate(template)}
          className="min-h-tap-min w-max rounded-full bg-accent px-5 text-sm font-semibold text-ink-on-accent disabled:opacity-50"
        >
          {taking ? t("templates.taking") : t("templates.take")}
        </button>
      </li>
    );
  };

  const gallery = (
    <section className="mt-10" data-testid="template-gallery">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
        {t("templates.heading")}
      </h2>
      {take.isError && (
        <p role="alert" className="mt-2 text-sm text-error">
          {t("templates.failed")}
        </p>
      )}
      {/* One column of compact card-rows on mobile, two-up cards on desktop. */}
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {visibleTemplates.map(templateCard)}
      </ul>
    </section>
  );

  const card = (program: ProgramSummary) => (
    /*
     * The whole card is the entrance (owner's call — the Open pill is gone):
     * a click anywhere opens the program, viewport-appropriately, via
     * openProgram. The name stays a real <Link> for keyboard users and
     * cmd+click; it and the action row stop propagation so their own
     * behaviors don't double-fire the card's.
     */
    <li
      key={program.id}
      data-testid="program-card"
      data-program-active={program.isActive}
      onClick={() => openProgram(program.id)}
      className="cursor-pointer rounded-card border border-border bg-surface p-5 transition-shadow duration-200 ease-out hover:shadow-card-hover"
    >
      <div className="flex flex-wrap items-center gap-3">
        {program.icon && (
          <span aria-hidden="true" className="text-xl">
            {program.icon}
          </span>
        )}
        <Link
          to="/programs/$programId"
          params={{ programId: program.id }}
          onClick={(event) => event.stopPropagation()}
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
        <span className="text-sm text-muted tabular-nums">{exerciseCountLabel(program)}</span>
      </div>

      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions --
          purely a propagation fence; every control inside is a real button */}
      <div className="mt-4 flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
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

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("programs.search")}
          aria-label={t("programs.search")}
          data-testid="program-search"
          className="min-h-tap-min flex-1 rounded-full border-2 border-border bg-surface px-5 text-ink shadow-search outline-none transition-colors duration-150 placeholder:text-muted focus:border-accent"
        />
        <button
          type="button"
          data-testid="create-program"
          disabled={create.isPending}
          onClick={() => create.mutate()}
          className="min-h-tap-min rounded-full bg-accent px-5 text-sm font-semibold text-ink-on-accent disabled:opacity-50"
        >
          {t("programs.new")}
        </button>
      </div>
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

      {programs.isSuccess && all.length === 0 && q === "" && (
        <>
          {/* A new account lands here with nothing — and "take a ready-made
              program" is a better first step than reading what a program is,
              so the gallery comes first. */}
          {gallery}
          <div className="mt-8 rounded-card border border-border bg-surface p-6" data-testid="programs-empty">
            <h2 className="text-lg font-semibold text-ink">{t("programs.empty.title")}</h2>
            <p className="mt-2 text-muted">{t("programs.empty.body")}</p>
          </div>
        </>
      )}

      {nothingMatches && (
        <p className="mt-8 text-muted" data-testid="search-empty">
          {t("library.empty")}
        </p>
      )}

      {live.length > 0 && <ul className="mt-8 flex flex-col gap-4">{live.map(card)}</ul>}

      {programs.isSuccess && (all.length > 0 || q !== "") && visibleTemplates.length > 0 && gallery}

      {archived.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            {t("programs.archived.heading")}
          </h2>
          <ul className="mt-4 flex flex-col gap-4">{archived.map(card)}</ul>
        </section>
      )}

      {openProgramId && window.matchMedia(DESKTOP).matches && (
        <ProgramDialog key={openProgramId} programId={openProgramId} onClose={closeDialog} />
      )}
    </div>
  );
}
