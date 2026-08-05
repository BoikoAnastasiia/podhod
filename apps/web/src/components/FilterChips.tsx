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
             * Accent now also carries hover/focus affordance, not only
             * committed state (see docs/design.md §5) — but selected vs.
             * inactive is still never conveyed by colour alone: selected
             * chips also drop the border and go bold (font-semibold).
             */
            className={
              active
                ? "min-h-tap-min rounded-full border-none bg-accent px-4 text-sm font-semibold text-ink-on-accent transition-colors duration-150"
                : "min-h-tap-min rounded-full border border-chip-border bg-surface px-4 text-sm text-ink transition-colors duration-150 hover:bg-chip-hover"
            }
          >
            {label(option)}
          </button>
        );
      })}
    </div>
  );
}
