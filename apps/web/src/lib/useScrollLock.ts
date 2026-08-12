import { useEffect } from "react";

/**
 * How many locks are currently held, and what to put back when the last one
 * lets go. Module scope rather than per-hook state because two overlapping
 * locks must not fight: the first to unmount would otherwise restore scrolling
 * while the second overlay is still open.
 */
let held = 0;
let restore = "";

/**
 * Freezes the document's scroll while `active`.
 *
 * A modal `<dialog>` does not do this on its own. It makes the rest of the page
 * inert — unclickable, untabbable — but the viewport is still the document's
 * scroller, so the wheel over the backdrop scrolls the page underneath. Turning
 * the editor's wheel into 581px of movement in the list behind it is measurably
 * what happened before this existed.
 *
 * The scrollbar's width is handled in CSS by `scrollbar-gutter: stable` on
 * `html` (see theme.css), not by padding compensation here: reserving the
 * gutter permanently means hiding the overflow takes no width away, so there is
 * nothing to compensate for and no jump to chase.
 */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    if (held === 0) {
      restore = root.style.overflow;
      root.style.overflow = "hidden";
    }
    held += 1;
    return () => {
      held -= 1;
      if (held === 0) root.style.overflow = restore;
    };
  }, [active]);
}
