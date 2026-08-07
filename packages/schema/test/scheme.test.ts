import { describe, expect, it } from "vitest";
import { parseSchemeConfig, schemeSchema } from "../src/scheme.js";

const valid = {
  fixed: { kind: "fixed", sets: 3, reps: 10, weightKg: 60 },
  linear: {
    kind: "linear",
    sets: 3,
    reps: 5,
    incrementKg: 2.5,
    failuresBeforeDeload: 3,
    deloadPct: 0.1,
  },
  double: { kind: "double", sets: 3, repLow: 8, repHigh: 12, incrementKg: 2.5 },
  rpe: { kind: "rpe", sets: 3, reps: 5, targetRpe: 8, adjustPct: 0.05 },
} as const;

describe("schemeSchema", () => {
  it.each(Object.entries(valid))("accepts a well-formed %s scheme", (_kind, scheme) => {
    expect(schemeSchema.safeParse(scheme).success).toBe(true);
  });

  it("rejects an unknown kind rather than passing it through", () => {
    expect(schemeSchema.safeParse({ ...valid.fixed, kind: "ladder" }).success).toBe(false);
  });

  it("rejects a double scheme whose range is inverted", () => {
    const inverted = { ...valid.double, repLow: 12, repHigh: 8 };
    const result = schemeSchema.safeParse(inverted);
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error.issues[0]?.path).toEqual(["repHigh"]);
  });

  it("rejects a range whose ends are equal, which would never progress", () => {
    expect(schemeSchema.safeParse({ ...valid.double, repLow: 10, repHigh: 10 }).success).toBe(
      false,
    );
  });

  /**
   * Percentages are fractions throughout. A 10 here means "multiply the weight
   * by −9", so the bound is what stops a plausible-looking 10 from reaching the
   * engine at all.
   */
  it.each([10, 1, 0, -0.1])("rejects deloadPct of %s, which is not a fraction", (deloadPct) => {
    expect(schemeSchema.safeParse({ ...valid.linear, deloadPct }).success).toBe(false);
  });

  it("accepts a half-point RPE target, which is a real prescription", () => {
    expect(schemeSchema.safeParse({ ...valid.rpe, targetRpe: 8.5 }).success).toBe(true);
  });

  it("rejects an RPE target outside the 1-10 scale", () => {
    expect(schemeSchema.safeParse({ ...valid.rpe, targetRpe: 11 }).success).toBe(false);
  });

  it("rejects a fractional set count", () => {
    expect(schemeSchema.safeParse({ ...valid.fixed, sets: 2.5 }).success).toBe(false);
  });
});

describe("parseSchemeConfig", () => {
  it("reads a stored scheme back", () => {
    const result = parseSchemeConfig(JSON.stringify(valid.linear));
    expect(result).toEqual({ ok: true, scheme: valid.linear });
  });

  /**
   * Both failure modes return a result rather than throwing: scheme_config is a
   * TEXT column, and one corrupt row must not take down the whole program page
   * it appears on.
   */
  it("reports malformed JSON without throwing", () => {
    const result = parseSchemeConfig("{not json");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error).toContain("not valid JSON");
  });

  it("reports well-formed JSON of the wrong shape without throwing", () => {
    const result = parseSchemeConfig(JSON.stringify({ kind: "linear", sets: 3 }));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error).toContain("scheme_config");
  });

  it("reports a JSON scalar, which parses but is not an object", () => {
    expect(parseSchemeConfig("42").ok).toBe(false);
  });

  it("reports null, which typeof calls an object", () => {
    expect(parseSchemeConfig("null").ok).toBe(false);
  });
});
