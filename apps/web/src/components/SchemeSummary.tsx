import type { SchemeInput } from "@podhod/schema";
import { useI18n } from "../i18n/useI18n.js";
import type { DictKey } from "../i18n/useI18n.js";
import { toPercent } from "./SchemeEditor.js";

const TEMPLATE: Record<SchemeInput["kind"], DictKey> = {
  fixed: "scheme.summary.fixed",
  linear: "scheme.summary.linear",
  double: "scheme.summary.double",
  rpe: "scheme.summary.rpe",
};

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
  const values = scheme as unknown as Record<string, number | string>;
  return t(TEMPLATE[scheme.kind]).replace(/\{(\w+)\}/g, (whole, key: string) => {
    const value = values[key];
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
