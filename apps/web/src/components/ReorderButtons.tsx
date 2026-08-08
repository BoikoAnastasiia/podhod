type Props = {
  index: number;
  count: number;
  /** Labels already interpolated with the item's name by the caller. */
  upLabel: string;
  downLabel: string;
  onMove: (from: number, to: number) => void;
};

const button =
  "flex size-tap-min items-center justify-center rounded-full border border-border bg-surface text-ink transition-colors duration-150 hover:bg-chip-hover disabled:opacity-30 disabled:hover:bg-surface";

/**
 * Up/down rather than dragging. Dragging would need a dependency, and an
 * accessible drag implementation — keyboard operation, live announcements,
 * a drop-position indicator — is considerably more work than the drag itself.
 * Two buttons are operable by keyboard and announced correctly for free. The
 * API takes a complete ordered list either way, so adding dragging later is a
 * change to this component and nothing else.
 *
 * The buttons **disable at the ends rather than disappearing**: a control that
 * vanishes changes the row's width as items move, so the button under the
 * pointer shifts out from under it exactly when someone is clicking repeatedly.
 *
 * Labels name the item ("Move Push earlier") rather than reading as a bare
 * arrow, which a screen reader announces as "button" with no object — useless
 * in a list of eight identical pairs.
 */
export function ReorderButtons({ index, count, upLabel, downLabel, onMove }: Props) {
  return (
    <span className="flex gap-1">
      <button
        type="button"
        className={button}
        aria-label={upLabel}
        data-testid="move-up"
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
      >
        <span aria-hidden="true">↑</span>
      </button>
      <button
        type="button"
        className={button}
        aria-label={downLabel}
        data-testid="move-down"
        disabled={index === count - 1}
        onClick={() => onMove(index, index + 1)}
      >
        <span aria-hidden="true">↓</span>
      </button>
    </span>
  );
}

/**
 * Moves one item and returns the whole new order, which is the shape the API
 * takes. Pure and exported so the reordering rule is testable without
 * rendering anything.
 */
export function moved<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items;
  }
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item === undefined) return items;
  next.splice(to, 0, item);
  return next;
}
