export function FilterChips({
  options,
  selected,
  onSelect,
  label,
}: {
  options: string[];
  selected: string | undefined;
  onSelect: (value: string | undefined) => void;
  label: (term: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = selected === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(active ? undefined : option)}
            /*
             * Ink blocks at rest, inverted when chosen (the owner's call,
             * 2026-08-12, picked from three options). The row used to be white
             * pills on a white panel behind a #ececec hairline, which had
             * almost no presence; and lime is spoken for on these screens by
             * the CTA, the active-program card and the "Added" badge, so it
             * would have said the wrong thing here.
             *
             * `bg-ink` / `text-canvas` rather than literal black and white, for
             * the reason UserMenu's sign-out button gives: ink flips to
             * near-white in the dark theme, so the chips stay contrast blocks
             * on both canvases rather than dissolving into one of them. The
             * inversion inverts with it.
             *
             * An inverted chip can read as *disabled* rather than *chosen* —
             * the known risk of this arrangement. Two things carry the state
             * besides the fill: the selected chip is the only outlined one in
             * the row, and it is the only bold one. `aria-pressed` carries it
             * for anyone not looking at the colours at all.
             *
             * Both states keep `border-2`, so selecting a chip cannot change
             * its box and shuffle the row's wrapping.
             */
            className={
              active
                ? "min-h-tap-min rounded-full border-2 border-ink bg-surface px-4 text-sm font-semibold text-ink transition duration-150 hover:bg-chip-hover"
                : "min-h-tap-min rounded-full border-2 border-ink bg-ink px-4 text-sm text-canvas transition duration-150 hover:opacity-85"
            }
          >
            {label(option)}
          </button>
        );
      })}
    </div>
  );
}
