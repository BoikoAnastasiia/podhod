import { Flip } from "gsap/Flip";
import gsap from "gsap";
import { useLayoutEffect, useRef } from "react";

/** Marks a row so the choreography can find it. */
export const FLIP_ROW = "data-flip-row";
/** Marks a thumbnail, in the picker and in a row, keyed by exercise. */
export const FLIP_THUMB = "data-flip-thumb";

const rows = (root: HTMLElement | null) =>
  root ? Array.from(root.querySelectorAll<HTMLElement>(`[${FLIP_ROW}]`)) : [];

/**
 * Every rearrangement of the exercise list, from one mechanism.
 *
 * Reordering, duplicating and removing all end the same way — the server is
 * the source of truth, the query invalidates, and React re-renders a list whose
 * rows have moved. Animating each of those separately would mean three
 * different pieces of code racing the same refetch. Instead the list's geometry
 * is recorded *before* the mutation and replayed once the new list is on
 * screen: Flip works out what moved, what arrived and what left, so a row that
 * slides up because the row above it was deleted is the same code path as a row
 * that slides up because you pressed the arrow.
 *
 * `onEnter`/`onLeave` are what make removal readable: a row Flip cannot find in
 * the new DOM is a row that left, and it gets faded out of the space it used to
 * hold rather than blinking away.
 */
export function useEntryChoreography(listRef: React.RefObject<HTMLElement | null>, key: string) {
  const pending = useRef<Flip.FlipState | null>(null);
  const previousKey = useRef(key);

  /** Call immediately before a mutation that will rearrange the list. */
  const capture = () => {
    pending.current = Flip.getState(rows(listRef.current));
  };

  useLayoutEffect(() => {
    if (previousKey.current === key) return;
    previousKey.current = key;

    const state = pending.current;
    pending.current = null;

    /*
     * The arrival is played from here, not from the mutation that caused it.
     * `await invalidate()` resolves when the query has refetched, which is
     * before React has committed the row it produced — so a flight launched
     * there had nothing to land on, found no target, and returned without a
     * word. A layout effect keyed on the rendered list runs at the first moment
     * the destination exists.
     */
    if (!state) {
      playThumbFlight();
      return;
    }

    const context = gsap.matchMedia();
    context.add("(prefers-reduced-motion: no-preference)", () => {
      Flip.from(state, {
        targets: rows(listRef.current),
        duration: 0.45,
        ease: "power2.inOut",
        /*
         * Only the row that is leaving comes out of flow, and only while it
         * fades — which is what lets the gap below it close smoothly.
         *
         * Emphatically not `absolute: true`. That lifts *every* row out of
         * flow for the duration, so the list collapses to nothing, the dialog
         * shrinks to fit its suddenly-empty content, and the whole editor
         * snaps back when the animation ends. It looked like the modal
         * imploding on every delete and every reorder.
         */
        absoluteOnLeave: true,
        stagger: 0.03,
        onEnter: (elements) =>
          gsap.fromTo(
            elements,
            { opacity: 0, scale: 0.96 },
            { opacity: 1, scale: 1, duration: 0.35, ease: "power2.out" },
          ),
        onLeave: (elements) =>
          gsap.to(elements, { opacity: 0, scale: 0.96, duration: 0.25, ease: "power2.in" }),
      });
      playThumbFlight();
    });
    return () => context.revert();
  }, [key, listRef]);

  return capture;
}

/**
 * The list playing itself in when a program is opened.
 *
 * Separate from the choreography above because it has no "before": there is no
 * previous geometry to flip from, only a list arriving. It runs once per
 * program — on the first render that has rows — rather than on every change,
 * or every added exercise would restage the whole list behind the one row that
 * actually moved.
 */
export function useEntranceStagger(
  listRef: React.RefObject<HTMLElement | null>,
  ready: boolean,
) {
  const played = useRef(false);

  useLayoutEffect(() => {
    if (!ready || played.current) return;
    const elements = rows(listRef.current);
    if (elements.length === 0) return;
    played.current = true;

    const context = gsap.matchMedia();
    context.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(elements, {
        opacity: 0,
        y: 12,
        duration: 0.4,
        ease: "power2.out",
        stagger: 0.04,
      });
    });
    return () => context.revert();
  }, [ready, listRef]);
}

/**
 * The thumbnail's flight from the picker into the row it becomes.
 *
 * Kept apart from the choreography above because it is the one animation that
 * crosses between two different lists — the picker's grid and the program's
 * rows — and because it has to wait for something the others do not: the row
 * lands at the end of the list, which on a long program is outside the dialog's
 * scrollport. Flying into a space nobody can see reads as nothing happening at
 * all, so the row is scrolled into view first and the flight measured after.
 */
let inFlight: { rect: DOMRect; exerciseId: string } | null = null;

export function captureThumbFlight(exerciseId: string): void {
  const source = document.querySelector<HTMLElement>(`[${FLIP_THUMB}="${exerciseId}"]`);
  inFlight = source ? { rect: source.getBoundingClientRect(), exerciseId } : null;
}

/**
 * Plays the arrival as a pure transform: the thumbnail starts displaced and
 * scaled to where it was in the picker, and returns to where it already is.
 *
 * Not Flip, and nothing positioned absolutely — that is the point. Flip's
 * `absolute` option lifts its target out of flow for the duration, and a
 * thumbnail lifted out of its row's flex line makes the row resize mid-flight
 * (measured: height swinging between 74px and 126px, which shoves everything
 * below it). Transforms are painted, never laid out, so the row it lands in
 * cannot feel this happen at all.
 */
export function playThumbFlight(): void {
  const flight = inFlight;
  inFlight = null;
  if (!flight) return;

  // The last match, not the first: duplicating an exercise means several rows
  // share an exercise, and the arrival is always the newest of them.
  const landed = document.querySelectorAll<HTMLElement>(
    `[${FLIP_ROW}] [${FLIP_THUMB}="${flight.exerciseId}"]`,
  );
  const target = landed[landed.length - 1];
  if (!target) return;

  const context = gsap.matchMedia();
  context.add("(prefers-reduced-motion: no-preference)", () => {
    // Measured after scrolling, or the destination is read at the position it
    // held before the list moved to reveal it.
    target.scrollIntoView({ block: "nearest" });
    const destination = target.getBoundingClientRect();
    if (destination.width === 0) return;

    gsap.fromTo(
      target,
      {
        x: flight.rect.left - destination.left,
        y: flight.rect.top - destination.top,
        scale: flight.rect.width / destination.width,
        transformOrigin: "top left",
      },
      {
        x: 0,
        y: 0,
        scale: 1,
        duration: 0.55,
        ease: "power2.inOut",
        onComplete: () => {
          // Leave no transform behind for the next layout to inherit.
          gsap.set(target, { clearProps: "transform" });
          context.revert();
        },
      },
    );
  });
}
