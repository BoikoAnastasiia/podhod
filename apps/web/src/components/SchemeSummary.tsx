import type { SchemeInput } from "@podhod/schema";
import { useI18n } from "../i18n/useI18n.js";
import type { DictKey } from "../i18n/useI18n.js";
import { toPercent } from "./SchemeEditor.js";

/**
 * Most kinds map to one template. The two that do not are the ones whose line
 * changes shape with the value: a bodyweight exercise says "3×12" on its own
 * and "3×12 · +20 kg" with a belt on, and time reads as minutes when it divides
 * evenly and as seconds when it does not — "0.75 min" is not how anyone says
 * forty-five seconds.
 */
function templateFor(scheme: SchemeInput): DictKey {
  switch (scheme.kind) {
    case "fixed":
      return "scheme.summary.fixed";
    case "linear":
      return "scheme.summary.linear";
    case "double":
      return "scheme.summary.double";
    case "rpe":
      return "scheme.summary.rpe";
    case "bodyweight":
      return scheme.addedWeightKg === 0
        ? "scheme.summary.bodyweight"
        : "scheme.summary.bodyweightLoaded";
    case "duration":
      return scheme.seconds >= 60 && scheme.seconds % 60 === 0
        ? "scheme.summary.duration"
        : "scheme.summary.durationSeconds";
  }
}

/**
 * A scheme as one line of text, from a per-kind dictionary template. Pure and
 * exported because the same line is needed in three places — the day editor's
 * exercise list, the picker's confirmation, and later the session player's
 * target line — and three hand-rolled renderings would drift apart.
 *
 * Fractions pass through `toPercent` before interpolation, so the line says
 * "10%" where the wire says 0.1 — the same boundary conversion the editor
 * makes, in the same direction readers expect.
 */
export function summarizeScheme(scheme: SchemeInput, t: (key: DictKey) => string): string {
  const values: Record<string, number | string> = {
    ...(scheme as unknown as Record<string, number | string>),
  };
  // Derived, not stored: the wire keeps seconds, the sentence wants minutes.
  if (scheme.kind === "duration") values.minutes = scheme.seconds / 60;
  // A signed number reads as a signed number: "+20 kg" of belt, "−20 kg" of
  // assistance. Without the sign the two are indistinguishable in the line.
  if (scheme.kind === "bodyweight" && scheme.addedWeightKg > 0) {
    values.addedWeightKg = `+${scheme.addedWeightKg}`;
  }

  return t(templateFor(scheme)).replace(/\{(\w+)\}/g, (whole, key: string) => {
    const value = values[key];
    if (typeof value === "string") return value;
    if (typeof value !== "number") return whole;
    return String(key.endsWith("Pct") ? toPercent(value) : value);
  });
}

export function SchemeSummary({ scheme }: { scheme: SchemeInput }) {
  const { t } = useI18n();
  return (
    <span className="text-sm text-muted tabular-nums" data-testid="scheme-summary">
      {summarizeScheme(scheme, t)}
    </span>
  );
}
