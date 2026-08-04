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
            /* Accent marks state, never decoration. Ink stays dark on accent. */
            className={
              active
                ? "min-h-tap-min rounded-full bg-accent px-4 text-sm font-medium text-ink-on-accent"
                : "min-h-tap-min rounded-full bg-surface px-4 text-sm text-ink"
            }
          >
            {label(option)}
          </button>
        );
      })}
    </div>
  );
}
