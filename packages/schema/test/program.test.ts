import { describe, expect, it } from "vitest";
import {
  createProgramExerciseSchema,
  createProgramSchema,
  programDetailSchema,
  reorderSchema,
  updateProgramExerciseSchema,
  updateProgramSchema,
} from "../src/program.js";

const LINEAR = {
  kind: "linear",
  sets: 3,
  reps: 5,
  incrementKg: 2.5,
  failuresBeforeDeload: 3,
  deloadPct: 0.1,
} as const;

describe("createProgramSchema", () => {
  it("accepts a named program", () => {
    expect(createProgramSchema.safeParse({ name: "5×5", notes: null }).success).toBe(true);
  });

  it("trims before checking the lower bound, so whitespace is not a name", () => {
    // "   " passes a naive min(1); trimming first is what makes the bound mean
    // what it says.
    expect(createProgramSchema.safeParse({ name: "   ", notes: null }).success).toBe(false);
  });

  it("stores the trimmed name rather than what was typed", () => {
    const result = createProgramSchema.safeParse({ name: "  5×5  ", notes: null });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data.name).toBe("5×5");
  });

  it("rejects a name past the practical limit", () => {
    expect(createProgramSchema.safeParse({ name: "x".repeat(81), notes: null }).success).toBe(
      false,
    );
  });

  it("allows notes to be omitted entirely", () => {
    expect(createProgramSchema.safeParse({ name: "5×5" }).success).toBe(true);
  });
});

describe("updateProgramSchema", () => {
  it("accepts a partial update", () => {
    expect(updateProgramSchema.safeParse({ isActive: true }).success).toBe(true);
  });

  it("accepts an empty object, which changes nothing", () => {
    // A PATCH with no fields is a no-op, not a client error.
    expect(updateProgramSchema.safeParse({}).success).toBe(true);
  });

  it("still rejects a bad value inside an otherwise partial update", () => {
    expect(updateProgramSchema.safeParse({ name: "" }).success).toBe(false);
  });
});

describe("createProgramExerciseSchema", () => {
  const base = { exerciseId: "0001", scheme: LINEAR, restSeconds: 90, notes: null };

  it("accepts a well-formed entry", () => {
    expect(createProgramExerciseSchema.safeParse(base).success).toBe(true);
  });

  /**
   * The scheme is validated at the edge so that nothing unparseable can reach
   * the scheme_config column. Once stored, the engine is entitled to assume the
   * JSON is a valid Scheme.
   */
  it("rejects a malformed scheme, so nothing unparseable can be stored", () => {
    expect(
      createProgramExerciseSchema.safeParse({ ...base, scheme: { kind: "linear", sets: 3 } })
        .success,
    ).toBe(false);
  });

  it("rejects an unknown scheme kind", () => {
    expect(
      createProgramExerciseSchema.safeParse({ ...base, scheme: { kind: "ladder", sets: 3 } })
        .success,
    ).toBe(false);
  });

  it("allows rest to be absent, falling back to the user's default", () => {
    const { restSeconds: _drop, ...withoutRest } = base;
    expect(createProgramExerciseSchema.safeParse(withoutRest).success).toBe(true);
  });

  it("allows an explicit zero rest, which is not the same as absent", () => {
    expect(createProgramExerciseSchema.safeParse({ ...base, restSeconds: 0 }).success).toBe(
      true,
    );
  });

  it("rejects a negative rest", () => {
    expect(createProgramExerciseSchema.safeParse({ ...base, restSeconds: -1 }).success).toBe(
      false,
    );
  });
});

describe("updateProgramExerciseSchema", () => {
  it("accepts a scheme-only change", () => {
    expect(updateProgramExerciseSchema.safeParse({ scheme: LINEAR }).success).toBe(true);
  });

  it("accepts an empty object", () => {
    expect(updateProgramExerciseSchema.safeParse({}).success).toBe(true);
  });
});

describe("reorderSchema", () => {
  it("accepts a complete ordered list", () => {
    expect(reorderSchema.safeParse({ ids: ["a", "b", "c"] }).success).toBe(true);
  });

  it("rejects an empty list rather than treating it as a no-op", () => {
    expect(reorderSchema.safeParse({ ids: [] }).success).toBe(false);
  });
});

describe("programDetailSchema", () => {
  it("describes a program as one flat workout — exercises, no days tier", () => {
    const detail = {
      id: "p1",
      name: "monday",
      notes: null,
      icon: null,
      iconColor: null,
      isActive: true,
      archivedAt: null,
      createdAt: 1,
      exercises: [
        {
          id: "pe1",
          exerciseId: "0001",
          name: "bench press",
          imagePath: "images/0001.jpg",
          equipment: "barbell",
          bodyPart: "chest",
          position: 0,
          scheme: LINEAR,
          restSeconds: 90,
          notes: null,
        },
      ],
    };
    expect(programDetailSchema.safeParse(detail).success).toBe(true);
  });

  it("does not carry exerciseCount, which only the summary reports", () => {
    // The detail response already contains the exercises themselves; a count
    // alongside them is a second source for the same fact.
    expect("exerciseCount" in programDetailSchema.shape).toBe(false);
  });
});
