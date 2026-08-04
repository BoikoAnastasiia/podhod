import { describe, expect, it } from "vitest";
import { plural } from "./plural.js";

const SETS = { one: "подход", few: "подхода", many: "подходов" };

describe("plural (ru)", () => {
  it.each([
    [1, "подход"],
    [2, "подхода"],
    [3, "подхода"],
    [4, "подхода"],
    [5, "подходов"],
    [11, "подходов"],
    [21, "подход"],
    [22, "подхода"],
    [25, "подходов"],
    [0, "подходов"],
  ])("%i -> %s", (n, expected) => {
    expect(plural("ru", n, SETS)).toBe(expected);
  });
});

describe("plural (en)", () => {
  it("uses the one/other split", () => {
    const forms = { one: "set", other: "sets" };
    expect(plural("en", 1, forms)).toBe("set");
    expect(plural("en", 2, forms)).toBe("sets");
    expect(plural("en", 0, forms)).toBe("sets");
  });
});
