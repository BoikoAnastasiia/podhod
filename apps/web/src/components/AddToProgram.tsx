import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/useI18n.js";
import { authClient } from "../lib/authClient.js";
import { addExercise, createProgram, fetchPrograms } from "../lib/api.js";
import { programKeys } from "../lib/programKeys.js";
import { SCHEME_DEFAULTS } from "./SchemeEditor.js";

const pill =
  "flex min-h-tap-min items-center rounded-full border border-border bg-surface px-4 text-sm font-medium text-muted transition-colors duration-150 hover:bg-chip-hover hover:text-ink";

/**
 * "Add to program" straight from an exercise's own page — the library
 * becomes a storefront, not just a reference. The dialog offers the user's
 * live programs and a create-new path; either way the exercise lands with
 * the standard 4×10 default, editable in the program afterwards. Signed-out
 * visitors are sent through sign-in with a redirect back here, the same
 * loop requireSession uses.
 */
export function AddToProgram({ exerciseId }: { exerciseId: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const [addedTo, setAddedTo] = useState<{ id: string; name: string } | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) dialogRef.current?.showModal();
  }, [open]);

  const programs = useQuery({
    queryKey: programKeys.list(),
    queryFn: fetchPrograms,
    enabled: open && !!session,
  });
  const live = (programs.data?.programs ?? []).filter((p) => p.archivedAt === null);

  const add = useMutation({
    mutationFn: async (program: { id: string; name: string }) => {
      await addExercise(program.id, { exerciseId, scheme: SCHEME_DEFAULTS.fixed });
      return program;
    },
    onSuccess: async (program) => {
      setAddedTo(program);
      await queryClient.invalidateQueries({ queryKey: programKeys.all });
    },
  });

  const createAndAdd = useMutation({
    mutationFn: async () => {
      const name = t("programs.defaultName");
      const id = await createProgram({ name, notes: null });
      if (!id) throw new Error("internal");
      await addExercise(id, { exerciseId, scheme: SCHEME_DEFAULTS.fixed });
      return { id, name };
    },
    onSuccess: async (program) => {
      setAddedTo(program);
      await queryClient.invalidateQueries({ queryKey: programKeys.all });
    },
  });

  const close = () => {
    setOpen(false);
    setAddedTo(null);
    add.reset();
    createAndAdd.reset();
  };

  return (
    <>
      <button
        type="button"
        data-testid="add-to-program"
        onClick={() => {
          if (session) setOpen(true);
          else void navigate({ to: "/sign-in", search: { redirect: window.location.pathname } });
        }}
        className="inline-flex min-h-tap-min w-max items-center rounded-full bg-accent px-5 text-sm font-semibold text-ink-on-accent shadow-cta transition-shadow duration-200 ease-out hover:bg-accent-hover hover:shadow-cta-hover"
      >
        {t("addTo.button")}
      </button>

      {open && (
        <dialog
          ref={dialogRef}
          data-testid="add-to-program-dialog"
          onClose={close}
          className="m-auto w-full max-w-sm rounded-card border border-border bg-surface p-6 text-ink backdrop:bg-ink/50"
        >
          <h2 className="text-lg font-semibold">{t("addTo.title")}</h2>

          {(add.isError || createAndAdd.isError) && (
            <p role="alert" className="mt-2 text-sm text-error">
              {t("addTo.failed")}
            </p>
          )}

          {addedTo ? (
            <div className="mt-4 flex flex-col gap-4" data-testid="add-to-program-done">
              <p className="text-sm text-ink">
                {t("addTo.done").replace("{name}", addedTo.name)}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid="open-added-program"
                  onClick={() =>
                    void navigate({
                      to: "/programs/$programId",
                      params: { programId: addedTo.id },
                    })
                  }
                  className="min-h-tap-min rounded-full bg-accent px-5 text-sm font-semibold text-ink-on-accent"
                >
                  {t("programs.open")}
                </button>
                <button type="button" className={pill} onClick={() => dialogRef.current?.close()}>
                  {t("programs.close")}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-2">
              {programs.isPending && <p className="text-sm text-muted">{t("programs.loading")}</p>}
              {live.length === 0 && programs.isSuccess && (
                <p className="text-sm text-muted">{t("addTo.empty")}</p>
              )}
              {live.map((program) => (
                <button
                  key={program.id}
                  type="button"
                  data-testid="add-to-existing"
                  disabled={add.isPending || createAndAdd.isPending}
                  onClick={() => add.mutate({ id: program.id, name: program.name })}
                  className="flex min-h-row-min w-full flex-wrap items-center gap-2 rounded-row border border-border bg-surface px-3 text-left text-sm text-ink transition-colors duration-150 hover:bg-chip-hover disabled:opacity-50"
                >
                  {program.icon && <span aria-hidden="true">{program.icon}</span>}
                  <span className="font-medium">{program.name}</span>
                </button>
              ))}
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid="add-to-new-program"
                  disabled={add.isPending || createAndAdd.isPending}
                  onClick={() => createAndAdd.mutate()}
                  className="min-h-tap-min rounded-full bg-accent px-5 text-sm font-semibold text-ink-on-accent disabled:opacity-50"
                >
                  {t("programs.new")}
                </button>
                <button type="button" className={pill} onClick={() => dialogRef.current?.close()}>
                  {t("programs.close")}
                </button>
              </div>
            </div>
          )}
        </dialog>
      )}
    </>
  );
}
