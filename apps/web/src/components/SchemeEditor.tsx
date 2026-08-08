import { schemeSchema, type SchemeInput } from "@podhod/schema";
import { useState } from "react";
import { useI18n } from "../i18n/useI18n.js";
import type { DictKey } from "../i18n/useI18n.js";

export type SchemeKind = SchemeInput["kind"];

export const SCHEME_KINDS = ["fixed", "linear", "double", "rpe"] as const;

export const SCHEME_KIND_LABEL: Record<SchemeKind, DictKey> = {
  fixed: "scheme.kind.fixed",
  linear: "scheme.kind.linear",
  double: "scheme.kind.double",
  rpe: "scheme.kind.rpe",
};

type FieldSpec = {
  key: string;
  label: DictKey;
  /** Shown and edited as a whole percentage, stored as a fraction. */
  pct?: boolean;
};

/**
 * Which fields each kind's form shows, in display order. Also the conversion
 * map: `buildScheme` and `rawFromScheme` read `pct` off these specs, so a
 * field cannot render as a percentage while converting as a plain number.
 */
export const SCHEME_FIELDS: Record<SchemeKind, readonly FieldSpec[]> = {
  fixed: [
    { key: "sets", label: "scheme.field.sets" },
    { key: "reps", label: "scheme.field.reps" },
    { key: "weightKg", label: "scheme.field.weightKg" },
  ],
  linear: [
    { key: "sets", label: "scheme.field.sets" },
    { key: "reps", label: "scheme.field.reps" },
    { key: "incrementKg", label: "scheme.field.incrementKg" },
    { key: "failuresBeforeDeload", label: "scheme.field.failuresBeforeDeload" },
    { key: "deloadPct", label: "scheme.field.deloadPct", pct: true },
  ],
  double: [
    { key: "sets", label: "scheme.field.sets" },
    { key: "repLow", label: "scheme.field.repLow" },
    { key: "repHigh", label: "scheme.field.repHigh" },
    { key: "incrementKg", label: "scheme.field.incrementKg" },
  ],
  rpe: [
    { key: "sets", label: "scheme.field.sets" },
    { key: "reps", label: "scheme.field.reps" },
    { key: "targetRpe", label: "scheme.field.targetRpe" },
    { key: "adjustPct", label: "scheme.field.adjustPct", pct: true },
  ],
};

/**
 * Sensible starting values per scheme, so switching kind produces a valid
 * scheme immediately rather than a form full of empty required fields.
 *
 * These are training defaults, not arbitrary ones: 4 sets is how the owner's
 * trainer wrote every exercise, and it is what the instant add uses; 2.5 kg is
 * the smallest pair of plates most gyms have; three failures before a deload
 * and a 10% cut are the Starting Strength convention; 8–12 is the most common
 * hypertrophy range; RPE 8 with 5% steps is a standard autoregulated
 * prescription.
 */
export const SCHEME_DEFAULTS: Record<SchemeKind, SchemeInput> = {
  fixed: { kind: "fixed", sets: 4, reps: 10, weightKg: 20 },
  linear: {
    kind: "linear",
    sets: 3,
    reps: 5,
    incrementKg: 2.5,
    failuresBeforeDeload: 3,
    deloadPct: 0.1,
  },
  double: { kind: "double", sets: 3, repLow: 8, repHigh: 12, incrementKg: 2.5 },
  rpe: { kind: "rpe", sets: 3, reps: 8, targetRpe: 8, adjustPct: 0.05 },
};

/**
 * The form shows 10 and the schema wants 0.1. Converting at the boundary keeps
 * the wire format unambiguous (fractions everywhere, as packages/schema
 * documents) while the field reads the way a percentage field should. Doing it
 * anywhere else means two representations circulating in the same component.
 */
export function toFraction(percent: number): number {
  return percent / 100;
}

export function toPercent(fraction: number): number {
  // 0.29 * 100 is 28.999999999999996 in floats; a value that started life as
  // a tidy percentage must come back as one, or the form shows the noise.
  return Math.round(fraction * 100 * 1e6) / 1e6;
}

/**
 * Turns the form's raw strings into a scheme, or refuses. `Number("")` is 0,
 * not NaN, so the empty check must come before the numeric parse — otherwise
 * a blanked field silently becomes zero and the schema's error is about the
 * wrong thing. The schema parse is the same gate the server applies, so a
 * scheme this accepts cannot then be rejected on the wire.
 */
export function buildScheme(
  kind: SchemeKind,
  raw: Record<string, string>,
): { ok: true; scheme: SchemeInput } | { ok: false } {
  const candidate: Record<string, unknown> = { kind };
  for (const field of SCHEME_FIELDS[kind]) {
    const text = (raw[field.key] ?? "").trim();
    if (text === "") return { ok: false };
    const value = Number(text);
    if (!Number.isFinite(value)) return { ok: false };
    candidate[field.key] = field.pct ? toFraction(value) : value;
  }
  const parsed = schemeSchema.safeParse(candidate);
  return parsed.success ? { ok: true, scheme: parsed.data } : { ok: false };
}

/** The inverse of `buildScheme`: a stored scheme as the form's field strings. */
export function rawFromScheme(scheme: SchemeInput): Record<string, string> {
  const values = scheme as unknown as Record<string, number>;
  const raw: Record<string, string> = {};
  for (const field of SCHEME_FIELDS[scheme.kind]) {
    const value = values[field.key];
    if (value !== undefined) raw[field.key] = String(field.pct ? toPercent(value) : value);
  }
  return raw;
}

const pill =
  "min-h-tap-min rounded-full border border-chip-border bg-surface px-4 text-sm text-ink transition-colors duration-150 hover:bg-chip-hover";
const pillActive =
  "min-h-tap-min rounded-full border-none bg-accent px-4 text-sm font-semibold text-ink-on-accent transition-colors duration-150";

/**
 * One form for all four schemes, discriminated on `kind` the same way the
 * schema is. Each kind keeps its own raw field state, so switching to another
 * kind to compare and switching back does not discard half-entered values.
 */
export function SchemeEditor({
  initial,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: {
  initial: SchemeInput;
  submitLabel: string;
  pending?: boolean;
  onSubmit: (scheme: SchemeInput) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [kind, setKind] = useState<SchemeKind>(initial.kind);
  const [raw, setRaw] = useState<Record<SchemeKind, Record<string, string>>>(() => ({
    fixed: rawFromScheme(SCHEME_DEFAULTS.fixed),
    linear: rawFromScheme(SCHEME_DEFAULTS.linear),
    double: rawFromScheme(SCHEME_DEFAULTS.double),
    rpe: rawFromScheme(SCHEME_DEFAULTS.rpe),
    [initial.kind]: rawFromScheme(initial),
  }));

  const built = buildScheme(kind, raw[kind]);

  return (
    <form
      data-testid="scheme-editor"
      onSubmit={(event) => {
        event.preventDefault();
        if (built.ok) onSubmit(built.scheme);
      }}
    >
      <fieldset>
        <legend className="text-sm font-medium text-muted">{t("scheme.kindLabel")}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SCHEME_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              data-testid={`scheme-kind-${k}`}
              className={kind === k ? pillActive : pill}
              onClick={() => setKind(k)}
            >
              {t(SCHEME_KIND_LABEL[k])}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {SCHEME_FIELDS[kind].map((field) => (
          <label key={field.key}>
            <span className="block text-sm font-medium text-muted">{t(field.label)}</span>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={raw[kind][field.key] ?? ""}
              data-testid={`scheme-${field.key}`}
              onChange={(event) =>
                setRaw((prev) => ({
                  ...prev,
                  [kind]: { ...prev[kind], [field.key]: event.target.value },
                }))
              }
              className="mt-1 min-h-tap-min w-full rounded-row border border-border bg-surface px-3 text-ink tabular-nums"
            />
          </label>
        ))}
      </div>

      {!built.ok && (
        <p className="mt-3 text-sm text-muted" data-testid="scheme-invalid">
          {t("scheme.invalid")}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          data-testid="scheme-submit"
          disabled={!built.ok || pending}
          className="min-h-tap-min rounded-full bg-accent px-5 text-sm font-semibold text-ink-on-accent disabled:opacity-50"
        >
          {submitLabel}
        </button>
        <button
          type="button"
          data-testid="scheme-cancel"
          className={pill}
          onClick={onCancel}
        >
          {t("scheme.cancel")}
        </button>
      </div>
    </form>
  );
}
