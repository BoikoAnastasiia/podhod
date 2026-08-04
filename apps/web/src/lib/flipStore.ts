import { Flip } from "gsap/Flip";

/**
 * Flip animates from a recorded state object rather than a live element, so
 * the outgoing route never has to stay mounted. That is why route transitions
 * here need no presence layer and no delayed unmount.
 */
let pending: Flip.FlipState | null = null;

export function captureThumb(id: string): void {
  const el = document.querySelector(`[data-exercise-id="${id}"]`);
  pending = el ? Flip.getState(el) : null;
}

export function takeThumbState(): Flip.FlipState | null {
  const state = pending;
  pending = null;
  return state;
}
