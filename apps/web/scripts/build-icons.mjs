/**
 * Splits the ten-icon muscle sheet into ten independent glyphs.
 *
 * The source (src/icons/muscles.svg) is one 3072×2048 artboard holding the ten
 * icons across three <path> elements — the layout is a visual fact of the
 * artwork, not a structural one, so there is nothing in the file to key on.
 * This walks every subpath, groups them by overlapping bounding boxes, then
 * bands the groups into rows and reads them left to right.
 *
 * Rows are found by the vertical gap between glyphs rather than by a declared
 * grid: this sheet is 6 over 4, not a rectangle, and the next one may be
 * neither. The row-major order that falls out is what pairs each glyph with its
 * name in NAMES below, so the two must stay in step.
 *
 * Run with `pnpm --filter @podhod/web run icons:build`. The generated module is
 * committed; this only needs re-running when the source sheet changes.
 */
import { readFileSync, writeFileSync } from "node:fs";

/**
 * The order the grid reads in — row-major from the source sheet — paired with
 * the name each cell is known by everywhere else in the app. Renaming one here
 * is a data migration, not a cosmetic change: these strings are stored in
 * `programs.icon`.
 */
const NAMES = [
  "back",
  "cardio",
  "chest",
  "forearms",
  "calves",
  "neck",
  "shoulders",
  "biceps",
  "quads",
  "core",
];

const NUMBER = /-?\d*\.?\d+(?:[eE][-+]?\d+)?/;
const TOKEN = new RegExp(`[A-Za-z]|${NUMBER.source}`, "g");

/**
 * Walks one `d` attribute and returns its subpaths, each rewritten into
 * absolute coordinates with its own bounding box.
 *
 * Absolute rewriting is what makes a subpath movable: relative subpaths start
 * from wherever the previous one ended, so lifting one out of the middle of a
 * path without this would land it in the wrong place. The pen therefore has to
 * be tracked continuously *across* subpath boundaries while it walks.
 *
 * Curve bounds use the control points rather than solving for the curve's real
 * extrema. That over-estimates slightly, which for clustering is the harmless
 * direction to be wrong in — it can only merge neighbours that were already
 * touching, never split an icon apart — and the emitted viewBox carries enough
 * padding to absorb it.
 */
function subpathsOf(d) {
  const tokens = d.match(TOKEN) ?? [];
  const subpaths = [];
  let i = 0;
  let command = "";
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let current = null;

  const grow = (px, py) => {
    current.minX = Math.min(current.minX, px);
    current.maxX = Math.max(current.maxX, px);
    current.minY = Math.min(current.minY, py);
    current.maxY = Math.max(current.maxY, py);
  };
  const next = () => Number(tokens[i++]);

  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) command = tokens[i++];
    const relative = command !== command.toUpperCase();
    const kind = command.toUpperCase();

    if (kind === "M") {
      const a = next();
      const b = next();
      x = relative ? x + a : a;
      y = relative ? y + b : b;
      startX = x;
      startY = y;
      current = { minX: x, maxX: x, minY: y, maxY: y, commands: [`M${x} ${y}`] };
      subpaths.push(current);
      // Coordinate pairs repeated after a moveto are implicit linetos.
      command = relative ? "l" : "L";
      continue;
    }

    if (kind === "L" || kind === "H" || kind === "V") {
      if (kind === "L") {
        const a = next();
        const b = next();
        x = relative ? x + a : a;
        y = relative ? y + b : b;
      } else if (kind === "H") {
        const a = next();
        x = relative ? x + a : a;
      } else {
        const a = next();
        y = relative ? y + a : a;
      }
      grow(x, y);
      current.commands.push(`L${x} ${y}`);
    } else if (kind === "C" || kind === "S" || kind === "Q") {
      const count = kind === "C" ? 6 : 4;
      const points = Array.from({ length: count }, next);
      const absolute = [];
      for (let k = 0; k < count; k += 2) {
        const px = relative ? x + points[k] : points[k];
        const py = relative ? y + points[k + 1] : points[k + 1];
        absolute.push(px, py);
        grow(px, py);
      }
      x = absolute[count - 2];
      y = absolute[count - 1];
      current.commands.push(`${kind}${absolute.join(" ")}`);
    } else if (kind === "Z") {
      x = startX;
      y = startY;
      current.commands.push("Z");
    } else {
      // Arcs and the rest are absent from this sheet. Failing loudly beats
      // emitting a silently mangled glyph if a future sheet contains one.
      throw new Error(`unsupported path command: ${command}`);
    }
  }
  return subpaths;
}

const source = readFileSync(new URL("../src/icons/muscles.svg", import.meta.url), "utf8");
const paths = [...source.matchAll(/ d="([^"]+)"/g)].map((match) => match[1]);
const subpaths = paths.flatMap(subpathsOf);

/**
 * Union-find over overlapping bounding boxes. The interior white lines are
 * counter-wound subpaths sitting inside their icon's box, so this keeps each
 * glyph's holes attached to it — and the winding order is preserved untouched,
 * which is what makes them render as holes under the default nonzero fill rule.
 */
const PAD = 8;
const parent = subpaths.map((_, index) => index);
const find = (a) => (parent[a] === a ? a : (parent[a] = find(parent[a])));
const union = (a, b) => {
  const rootA = find(a);
  const rootB = find(b);
  if (rootA !== rootB) parent[rootA] = rootB;
};
const overlap = (a, b) =>
  a.minX - PAD <= b.maxX &&
  b.minX - PAD <= a.maxX &&
  a.minY - PAD <= b.maxY &&
  b.minY - PAD <= a.maxY;

for (let a = 0; a < subpaths.length; a++) {
  for (let b = a + 1; b < subpaths.length; b++) {
    if (overlap(subpaths[a], subpaths[b])) union(a, b);
  }
}

const bounds = (parts) => ({
  minX: Math.min(...parts.map((p) => p.minX)),
  maxX: Math.max(...parts.map((p) => p.maxX)),
  minY: Math.min(...parts.map((p) => p.minY)),
  maxY: Math.max(...parts.map((p) => p.maxY)),
});

const byRoot = new Map();
subpaths.forEach((subpath, index) => {
  const root = find(index);
  if (!byRoot.has(root)) byRoot.set(root, []);
  byRoot.get(root).push(subpath);
});
const clusters = [...byRoot.values()].map((parts) => ({ parts, ...bounds(parts) }));

const midY = (cluster) => (cluster.minY + cluster.maxY) / 2;

/**
 * Band the glyphs into rows. A new row starts wherever the vertical gap between
 * consecutive centres exceeds half the median glyph height — comfortably larger
 * than the few pixels glyphs on one row differ by, and comfortably smaller than
 * the space between rows.
 */
const heights = clusters.map((cluster) => cluster.maxY - cluster.minY).sort((a, b) => a - b);
const rowGap = heights[Math.floor(heights.length / 2)] / 2;

const rows = [];
for (const cluster of [...clusters].sort((a, b) => midY(a) - midY(b))) {
  const row = rows.at(-1);
  if (row && midY(cluster) - midY(row.at(-1)) < rowGap) row.push(cluster);
  else rows.push([cluster]);
}
for (const row of rows) row.sort((a, b) => a.minX - b.minX);

const ordered = rows.flat();
if (ordered.length !== NAMES.length) {
  throw new Error(`expected ${NAMES.length} icons, found ${ordered.length}`);
}

const icons = ordered.map((cluster, index) => ({
  name: NAMES[index],
  parts: cluster.parts,
  ...bounds(cluster.parts),
}));
console.log(`rows: ${rows.map((row) => row.length).join(" + ")}`);

/**
 * One square viewBox for every glyph, sized to the largest and centred on each.
 * A per-glyph box would scale each icon up to fill it, flattening the size
 * relationships the sheet was drawn with — the heart is meant to read smaller
 * than the torso. A shared box keeps them.
 */
const BOX =
  Math.ceil(Math.max(...icons.map((icon) => Math.max(icon.maxX - icon.minX, icon.maxY - icon.minY)))) +
  24;

/**
 * Integer coordinates. On a ~322-unit box the rounding error is under a third
 * of a percent — invisible at the 20-64px these render at — and it cuts the
 * generated module from 75KB to 22KB (15.4KB to 8.4KB gzipped).
 */
const round = (value) => String(Math.round(value));
const entries = icons.map((icon) => {
  const offsetX = icon.minX - (BOX - (icon.maxX - icon.minX)) / 2;
  const offsetY = icon.minY - (BOX - (icon.maxY - icon.minY)) / 2;
  const d = icon.parts
    .map((part) => part.commands.join(""))
    .join("")
    .replace(/-?\d+\.\d+/g, (n) => round(n));
  return `  ${icon.name}: "${d}",`;
});

const module = `/**
 * GENERATED by scripts/build-icons.mjs from src/icons/muscles.svg.
 * Do not edit by hand — re-run \`pnpm --filter @podhod/web run icons:build\`.
 *
 * Every glyph shares one square viewBox so the sheet's relative sizing survives
 * the split; see the generator for why the grid is derived rather than declared.
 *
 * Keyed by ProgramIconName rather than by string on purpose: the names are
 * stored in \`programs.icon\` and validated by the API against that same list,
 * so a glyph added here without a name added there — or the reverse — is a
 * type error rather than a program whose icon silently renders as nothing.
 */
import type { ProgramIconName } from "@podhod/schema";

/** The shared square viewBox's side; each glyph supplies its own offset. */
export const ICON_VIEWBOX_SIZE = ${BOX};

export const ICON_OFFSETS: Record<ProgramIconName, readonly [number, number]> = {
${icons
  .map((icon) => {
    const offsetX = icon.minX - (BOX - (icon.maxX - icon.minX)) / 2;
    const offsetY = icon.minY - (BOX - (icon.maxY - icon.minY)) / 2;
    return `  ${icon.name}: [${round(offsetX)}, ${round(offsetY)}],`;
  })
  .join("\n")}
};

export const ICON_PATHS: Record<ProgramIconName, string> = {
${entries.join("\n")}
};
`;

writeFileSync(new URL("../src/icons/programIcons.generated.ts", import.meta.url), module);
console.log(
  `wrote programIcons.generated.ts — ${icons.length} icons, box ${BOX}, ${module.length} bytes`,
);
