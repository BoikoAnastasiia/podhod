import {
  PROGRAM_ICON_COLOR_PRESETS,
  PROGRAM_ICON_NAMES,
  type ProgramIconColorPreset,
  type ProgramIconName,
} from "@podhod/schema";
import { ICON_OFFSETS, ICON_PATHS, ICON_VIEWBOX_SIZE } from "../icons/programIcons.generated.js";

const symbolId = (name: string) => `podhod-icon-${name}`;

/**
 * The sprite proper: every glyph's path data, once per document, mounted by the
 * root shell. Programs then reference a glyph with a <use> element a few bytes
 * long, so a list of thirty programs costs thirty references rather than thirty
 * copies of a 2KB path.
 *
 * Inlined rather than served as an external /icons.svg: an external <use> href
 * has a long history of not working in Safari, and the whole sheet is 8.4KB
 * gzipped — less than one of the exercise thumbnails it sits next to.
 */
export function ProgramIconSprite() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ display: "none" }}>
      {PROGRAM_ICON_NAMES.map((name) => {
        const [x, y] = ICON_OFFSETS[name];
        return (
          <symbol
            key={name}
            id={symbolId(name)}
            viewBox={`${x} ${y} ${ICON_VIEWBOX_SIZE} ${ICON_VIEWBOX_SIZE}`}
          >
            <path d={ICON_PATHS[name]} fill="currentColor" />
          </symbol>
        );
      })}
    </svg>
  );
}

/**
 * Stored icons are read back as plain strings — a row written before migration
 * 0005, or by a newer build that knows a glyph this one does not, must not blow
 * up the page. An unrecognised name renders as no icon at all.
 */
export function isProgramIconName(value: string | null | undefined): value is ProgramIconName {
  return value !== null && value !== undefined && value in ICON_PATHS;
}

const isPreset = (value: string): value is ProgramIconColorPreset =>
  (PROGRAM_ICON_COLOR_PRESETS as readonly string[]).includes(value);

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Resolves a stored colour to a CSS value. Presets go through their token so
 * they follow the theme — the tokens carry a different value per theme, since
 * the accent lime that reads well on a near-black card measures ~1.14:1 on a
 * white one and effectively disappears (see theme.css). A custom hex is the
 * user's own call and is used as-is; anything unrecognised falls back to ink.
 */
export function programIconColor(color: string | null | undefined): string {
  if (color && isPreset(color)) return `var(--color-icon-${color})`;
  if (color && HEX.test(color)) return color;
  return "var(--color-icon-ink)";
}

/**
 * A single glyph. Decorative by default: the program's name is always beside
 * it, so announcing the icon too would just make a screen reader say the same
 * thing twice. Pass a label only where the icon stands alone.
 */
export function ProgramIcon({
  name,
  color,
  className = "size-6",
  label,
  /**
   * Null inside the picker's own grid: ten more elements answering to
   * "program-icon" would make every test that looks for *the* program's icon
   * depend on DOM order to find it.
   */
  testId = "program-icon",
}: {
  name: string;
  color?: string | null;
  className?: string;
  label?: string;
  testId?: string | null;
}) {
  if (!isProgramIconName(name)) return null;
  return (
    <svg
      className={className}
      style={{ color: programIconColor(color) }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-testid={testId ?? undefined}
      data-icon={name}
    >
      <use href={`#${symbolId(name)}`} />
    </svg>
  );
}
