import {
  PROGRAM_ICON_COLOR_PRESETS,
  PROGRAM_ICON_NAMES,
  type ProgramIconName,
} from "@podhod/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "../i18n/useI18n.js";
import { updateProgram } from "../lib/api.js";
import { programKeys } from "../lib/programKeys.js";
import { isProgramIconName, ProgramIcon, programIconColor } from "./ProgramIcon.js";

/** The sm breakpoint, where the panel stops being a bottom sheet. */
const WIDE = "(min-width: 40rem)";
const GAP = 8;

/**
 * Places the open panel under its trigger, in JS.
 *
 * CSS anchor positioning is what this wants to be, but it is Chromium-only —
 * the polyfill cannot do implicit anchors and does not handle `position-area`
 * on popovers, which is most of the reason to want it. Twelve lines of
 * `getBoundingClientRect` cost less than that and work everywhere the Popover
 * API does. Below sm the panel is a bottom sheet instead, which needs no
 * measuring at all.
 */
function usePanelPosition(
  open: boolean,
  trigger: React.RefObject<HTMLButtonElement | null>,
  panel: React.RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    if (!open) return;

    const place = () => {
      const box = panel.current;
      const anchor = trigger.current;
      if (!box || !anchor) return;

      if (!window.matchMedia(WIDE).matches) {
        // A sheet sits on the viewport's bottom edge, so its bottom corners
        // have nothing to round against.
        box.style.cssText =
          "position:fixed;inset:auto 0 0 0;margin:0;width:100%;max-width:none;border-bottom-left-radius:0;border-bottom-right-radius:0";
        return;
      }

      const rect = anchor.getBoundingClientRect();
      box.style.cssText = "position:fixed;inset:auto;margin:0";
      const { offsetWidth: width, offsetHeight: height } = box;
      // Flip above the trigger when there is no room below it, and keep the
      // panel inside the viewport horizontally either way.
      const below = rect.bottom + GAP;
      const top = below + height > window.innerHeight - GAP ? Math.max(GAP, rect.top - GAP - height) : below;
      const left = Math.max(GAP, Math.min(rect.left, window.innerWidth - width - GAP));
      box.style.cssText = `position:fixed;inset:auto;margin:0;top:${top}px;left:${left}px`;
    };

    place();
    window.addEventListener("resize", place);
    // Capture phase: the editor scrolls inside a <dialog> on desktop, and that
    // scroll does not bubble to the window.
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, trigger, panel]);
}

const swatch =
  "flex size-8 items-center justify-center rounded-full border border-chip-border transition-transform duration-150 hover:scale-110";

/**
 * The program's icon, and the panel for changing it. The icon *is* the trigger
 * — there is no separate "Icon" button any more — so a program with no icon
 * still shows a muted placeholder to click.
 *
 * The panel is a native popover: it needs to escape the desktop editor's
 * `<dialog class="overflow-y-auto">`, which would clip an absolutely-positioned
 * panel, and the top layer is the only thing that does that without moving the
 * markup somewhere else in the tree. Light dismiss and Escape come free with
 * it, so unlike UserMenu this component hand-rolls neither.
 */
export function IconPicker({
  programId,
  icon,
  iconColor,
}: {
  programId: string;
  icon: string | null;
  iconColor: string | null;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  /** The custom colour mid-drag, so the icon previews before the write lands. */
  const [draft, setDraft] = useState<string | null>(null);
  const debounce = useRef<number | undefined>(undefined);

  usePanelPosition(open, triggerRef, panelRef);

  const save = useMutation({
    mutationFn: (patch: { icon?: ProgramIconName | null; iconColor?: string | null }) =>
      updateProgram(programId, patch),
    onSuccess: async () => {
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey: programKeys.all });
    },
  });

  // A dragged colour input fires continuously; one write per drag, not per
  // frame. The draft carries the preview in the meantime.
  const pickCustom = (value: string) => {
    setDraft(value);
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => save.mutate({ iconColor: value }), 250);
  };
  useEffect(() => () => window.clearTimeout(debounce.current), []);

  const shown = draft ?? iconColor;
  const chosenCustom =
    shown && !(PROGRAM_ICON_COLOR_PRESETS as readonly string[]).includes(shown) ? shown : null;
  /** The native input needs a hex even when nothing custom has been picked. */
  const custom = chosenCustom ?? "#171717";

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        popoverTarget={panelId}
        data-testid="change-icon"
        aria-label={t("icon.change")}
        className="flex size-tap-min items-center justify-center rounded-full border border-chip-border bg-surface transition-colors duration-150 hover:bg-chip-hover"
      >
        {isProgramIconName(icon) ? (
          <ProgramIcon name={icon} color={shown} className="size-7" />
        ) : (
          // No icon yet: a muted placeholder, so the trigger is never invisible.
          <span
            aria-hidden="true"
            data-testid="program-icon-empty"
            className="size-5 rounded-full border-2 border-dashed border-muted"
          />
        )}
      </button>

      <div
        ref={panelRef}
        id={panelId}
        popover="auto"
        data-testid="icon-panel"
        onToggle={(event) => setOpen(event.newState === "open")}
        className="w-72 max-w-full rounded-card border border-border bg-surface p-4 text-ink shadow-card-hover"
      >
        <div className="grid grid-cols-5 gap-1" data-testid="icon-options">
          {PROGRAM_ICON_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={icon === name}
              aria-label={t(`icon.name.${name}`)}
              data-testid={`icon-option-${name}`}
              disabled={save.isPending}
              onClick={() => save.mutate({ icon: name })}
              className={
                icon === name
                  ? "flex size-tap-min items-center justify-center rounded-row bg-chip-hover"
                  : "flex size-tap-min items-center justify-center rounded-row transition-colors duration-150 hover:bg-chip-hover"
              }
            >
              <ProgramIcon name={name} color={shown} className="size-7" testId={null} />
            </button>
          ))}
        </div>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">
          {t("icon.color")}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {PROGRAM_ICON_COLOR_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={iconColor === preset || (iconColor === null && preset === "ink")}
              aria-label={t(`icon.color.${preset}`)}
              data-testid={`icon-color-${preset}`}
              disabled={save.isPending}
              onClick={() => {
                setDraft(null);
                save.mutate({ iconColor: preset });
              }}
              className={swatch}
              style={{ backgroundColor: programIconColor(preset) }}
            />
          ))}
          {/*
           * A custom colour cannot follow the theme the way a preset does — it
           * is one value against two canvases, and a dark pick will be faint on
           * the dark theme. The icon previews live as the input moves, which is
           * the honest way to let someone judge that for themselves.
           */}
          {/*
           * Until something custom is chosen the swatch is a colour wheel, not
           * a colour: the honest default (#171717) is a black disc on a black
           * card in the dark theme — an invisible control where the one thing
           * it must do is announce itself.
           */}
          <label
            className={`${swatch} relative cursor-pointer overflow-hidden`}
            style={
              chosenCustom
                ? { backgroundColor: chosenCustom }
                : {
                    backgroundImage:
                      "conic-gradient(#ff3b30, #f97316, #8ac400, #10b981, #3b82f6, #a855f7, #ff3b30)",
                  }
            }
          >
            <span className="sr-only">{t("icon.color.custom")}</span>
            <input
              type="color"
              value={custom}
              data-testid="icon-color-custom"
              onChange={(event) => pickCustom(event.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>

        {icon !== null && (
          <button
            type="button"
            data-testid="icon-option-none"
            disabled={save.isPending}
            onClick={() => save.mutate({ icon: null })}
            className="mt-4 flex min-h-tap-min w-full items-center justify-center rounded-full border border-border text-sm font-medium text-muted transition-colors duration-150 hover:bg-chip-hover hover:text-ink"
          >
            {t("icon.remove")}
          </button>
        )}
      </div>
    </>
  );
}


