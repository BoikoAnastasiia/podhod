import { schemeSchema } from "@podhod/schema";
import { describe, expect, it } from "vitest";
import {
  buildScheme,
  rawFromScheme,
  SCHEME_DEFAULTS,
  toFraction,
  toPercent,
} from "./SchemeEditor.js";
import { summarizeScheme } from "./SchemeSummary.js";
import { dict } from "../i18n/dict.js";

describe("percent/fraction conversion", () => {
  it.each([
    [10, 0.1],
    [5, 0.05],
    [2.5, 0.025],
  ])("converts %s%% to %s", (percent, fraction) => {
    expect(toFraction(percent)).toBeCloseTo(fraction, 10);
  });

  it.each([10, 5, 2.5, 33, 7])("round-trips %s%% exactly", (percent) => {
    // 0.29 * 100 is 28.999999999999996 in floats — the round trip must not
    // leak that noise back into a field someone typed a tidy number into.
    expect(toPercent(toFraction(percent))).toBe(percent);
  });
});

describe("SCHEME_DEFAULTS", () => {
  it("round-trips every default through the schema it must satisfy", () => {
    // A default that fails validation would make the editor unusable on open —
    // the one state a user cannot avoid reaching.
    for (const scheme of Object.values(SCHEME_DEFAULTS)) {
      expect(schemeSchema.safeParse(scheme).success).toBe(true);
    }
  });

  it("keys each default under its own kind", () => {
    for (const [kind, scheme] of Object.entries(SCHEME_DEFAULTS)) {
      expect(scheme.kind).toBe(kind);
    }
  });
});

describe("buildScheme", () => {
  it("builds a fixed scheme from raw field strings", () => {
    const built = buildScheme("fixed", { sets: "3", reps: "10", weightKg: "20" });
    expect(built).toEqual({
      ok: true,
      scheme: { kind: "fixed", sets: 3, reps: 10, weightKg: 20 },
    });
  });

  it("converts percentage fields from whole numbers to fractions", () => {
    const built = buildScheme("linear", {
      sets: "3",
      reps: "5",
      incrementKg: "2.5",
      failuresBeforeDeload: "3",
      deloadPct: "10",
    });
    expect(built.ok).toBe(true);
    if (built.ok && built.scheme.kind === "linear") {
      expect(built.scheme.deloadPct).toBeCloseTo(0.1, 10);
    }
  });

  it("refuses an empty field rather than reading it as zero", () => {
    // Number("") is 0, not NaN — without the explicit empty check a blanked
    // sets field would become a zero-set scheme and fail somewhere else.
    expect(buildScheme("fixed", { sets: "", reps: "10", weightKg: "20" })).toEqual({
      ok: false,
    });
  });

  it("refuses a non-numeric field", () => {
    expect(buildScheme("fixed", { sets: "three", reps: "10", weightKg: "20" })).toEqual({
      ok: false,
    });
  });

  it("refuses a percentage outside the open (0, 100) range", () => {
    for (const deloadPct of ["0", "100"]) {
      expect(
        buildScheme("linear", {
          sets: "3",
          reps: "5",
          incrementKg: "2.5",
          failuresBeforeDeload: "3",
          deloadPct,
        }),
      ).toEqual({ ok: false });
    }
  });

  it("refuses a double scheme whose rep range is inverted or flat", () => {
    for (const repHigh of ["8", "6"]) {
      expect(
        buildScheme("double", { sets: "3", repLow: "8", repHigh, incrementKg: "2.5" }),
      ).toEqual({ ok: false });
    }
  });

  it("round-trips every default through rawFromScheme", () => {
    for (const scheme of Object.values(SCHEME_DEFAULTS)) {
      expect(buildScheme(scheme.kind, rawFromScheme(scheme))).toEqual({ ok: true, scheme });
    }
  });
});

describe("summarizeScheme", () => {
  const t = (key: keyof (typeof dict)["en"]) => dict.en[key];

  it("renders a fixed scheme as sets×reps and weight", () => {
    expect(summarizeScheme({ kind: "fixed", sets: 3, reps: 10, weightKg: 20 }, t)).toBe(
      "3×10 · 20 kg",
    );
  });

  it("renders percentages as whole numbers, not fractions", () => {
    const line = summarizeScheme(SCHEME_DEFAULTS.linear, t);
    expect(line).toContain("10%");
    expect(line).not.toContain("0.1");
  });

  it("leaves no unfilled placeholders in any default's summary", () => {
    for (const scheme of Object.values(SCHEME_DEFAULTS)) {
      for (const lang of ["en", "ru"] as const) {
        const line = summarizeScheme(scheme, (key) => dict[lang][key]);
        expect(line).not.toMatch(/\{\w+\}/);
      }
    }
  });
});
