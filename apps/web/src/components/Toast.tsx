import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/** How long a toast stays before it dismisses itself. */
const LIFETIME_MS = 4000;
/** Older toasts drop off the top rather than filling the screen. */
const MAX_VISIBLE = 3;
/** Breathing room between the header's bottom edge and the first toast. */
const GAP_PX = 12;

type Toast = { id: number; message: string };

const ToastContext = createContext<((message: string) => void) | null>(null);

/**
 * Raises a toast. Deliberately just a string: a toast is a confirmation, not a
 * place to put controls — anything the user must act on belongs somewhere it
 * cannot time out.
 */
export function useToast(): (message: string) => void {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast used outside ToastProvider");
  return show;
}

/**
 * App-wide toasts, mounted once by the root shell.
 *
 * Positioned under the header rather than over it: the header is fixed and its
 * height changes when it compacts, so the offset comes from the shell, which
 * measures it. A constant would either overlap the two-row mobile header or
 * float absurdly low on desktop.
 *
 * The live region is the empty container, not each toast — an aria-live region
 * must exist in the DOM *before* the text lands in it, otherwise the insertion
 * is not an update to anything and screen readers stay silent.
 *
 * It is a popover so that it renders in the *top layer*. The first version used
 * z-40, which is unreachably far below a `<dialog>` opened with showModal():
 * the top layer sits above the entire z-index stack, so every toast raised
 * while the desktop program editor was open — the exact place exercises are
 * added — was drawn behind it. The bug was invisible to an assertion on the
 * toast's text or box, and only turned up in a screenshot.
 *
 * One consequence to know about: a modal dialog makes everything outside it
 * inert, so while the editor dialog is open a toast is visible but not
 * clickable. Dismissing by click is a convenience; the timeout is what actually
 * clears it, and that keeps working.
 */
export function ToastProvider({
  children,
  /** The fixed header's live height; toasts clear it by GAP_PX. */
  topOffset,
}: {
  children: React.ReactNode;
  topOffset: number;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, number>());
  const viewportRef = useRef<HTMLDivElement>(null);

  /**
   * Keeps the viewport in the top layer while there is anything to show.
   *
   * It re-enters the layer on every new toast rather than staying open, because
   * the top layer stacks in promotion order: a dialog opened *after* the
   * viewport would otherwise cover it, which is the original bug in a subtler
   * form. Hiding and re-showing puts the toast back on top of whatever is
   * currently there.
   */
  useEffect(() => {
    const el = viewportRef.current;
    // Absent in browsers without the Popover API, where the element simply
    // renders in the normal flow — degraded (a modal can cover it) but present.
    if (!el || typeof el.showPopover !== "function") return;
    const open = el.matches(":popover-open");
    if (toasts.length === 0) {
      if (open) el.hidePopover();
      return;
    }
    if (open) el.hidePopover();
    el.showPopover();
  }, [toasts]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (message: string) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message }].slice(-MAX_VISIBLE));
      timers.current.set(
        id,
        window.setTimeout(() => dismiss(id), LIFETIME_MS),
      );
    },
    [dismiss],
  );

  // Timers outlive the component otherwise, and fire setState on an unmounted
  // tree during a hot reload or a sign-out.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) window.clearTimeout(timer);
      pending.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        ref={viewportRef}
        popover="manual"
        className="pointer-events-none flex flex-col items-center gap-2"
        /*
         * Every box property is set here rather than in classes because the UA
         * stylesheet for [popover] supplies its own — fixed inset:0, auto
         * margins, a border, padding and an opaque background — and a utility
         * class does not reliably win against it.
         */
        style={{
          position: "fixed",
          inset: "auto",
          top: topOffset + GAP_PX,
          left: 0,
          right: 0,
          width: "auto",
          maxWidth: "none",
          height: "auto",
          margin: 0,
          border: "none",
          padding: "0 1rem",
          background: "transparent",
          overflow: "visible",
        }}
        role="status"
        aria-live="polite"
        data-testid="toast-viewport"
      >
        {toasts.map((toast) => (
          <button
            key={toast.id}
            type="button"
            data-testid="toast"
            onClick={() => dismiss(toast.id)}
            className="pointer-events-auto max-w-md rounded-full border border-border bg-ink px-5 py-3 text-sm font-medium text-canvas shadow-card-hover"
          >
            {toast.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
