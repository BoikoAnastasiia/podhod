import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PROGRAM_ICONS } from "../data/programTemplates.js";
import { useI18n } from "../i18n/useI18n.js";
import { updateProgram } from "../lib/api.js";
import { programKeys } from "../lib/programKeys.js";

const pill =
  "flex min-h-tap-min items-center rounded-full border border-border bg-surface px-4 text-sm font-medium text-muted transition-colors duration-150 hover:bg-chip-hover hover:text-ink";

/**
 * A curated preset row rather than a free emoji field: ten options need no
 * search UI, render identically everywhere, and the parked design pass can
 * swap the set for real iconography without a data migration — the column
 * stores whatever string the picker offers.
 */
export function IconPicker({
  programId,
  current,
}: {
  programId: string;
  current: string | null;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const save = useMutation({
    mutationFn: (icon: string | null) => updateProgram(programId, { icon }),
    onSuccess: async () => {
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: programKeys.all });
    },
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={pill}
        data-testid="change-icon"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {t("icon.change")}
      </button>
      {open && (
        <span className="flex flex-wrap items-center gap-1" data-testid="icon-options">
          {PROGRAM_ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              aria-pressed={current === icon}
              data-testid={`icon-option-${icon}`}
              disabled={save.isPending}
              onClick={() => save.mutate(icon)}
              className={
                current === icon
                  ? "flex size-tap-min items-center justify-center rounded-full border-none bg-accent text-lg"
                  : "flex size-tap-min items-center justify-center rounded-full border border-chip-border bg-surface text-lg transition-colors duration-150 hover:bg-chip-hover"
              }
            >
              {icon}
            </button>
          ))}
          <button
            type="button"
            className={pill}
            data-testid="icon-option-none"
            disabled={save.isPending}
            onClick={() => save.mutate(null)}
          >
            {t("icon.none")}
          </button>
        </span>
      )}
    </div>
  );
}
