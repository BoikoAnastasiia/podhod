import { describe, expect, it } from "vitest";
import { moved } from "./ReorderButtons.js";

describe("moved", () => {
  const list = ["a", "b", "c", "d"];

  it("moves an item earlier", () => {
    expect(moved(list, 2, 1)).toEqual(["a", "c", "b", "d"]);
  });

  it("moves an item later", () => {
    expect(moved(list, 1, 2)).toEqual(["a", "c", "b", "d"]);
  });

  it("moves an item from the end to the start", () => {
    expect(moved(list, 3, 0)).toEqual(["d", "a", "b", "c"]);
  });

  it("returns the same order when nothing moves", () => {
    expect(moved(list, 1, 1)).toEqual(list);
  });

  /**
   * The API rejects a reorder whose ids are not exactly the day's own, so an
   * out-of-range index that silently dropped or duplicated an item would turn
   * a mis-click into a 400 with no explanation. Returning the list untouched
   * keeps a bad index a no-op.
   */
  it.each([
    [-1, 0],
    [0, -1],
    [4, 0],
    [0, 4],
  ])("ignores an out-of-range move (%s → %s)", (from, to) => {
    expect(moved(list, from, to)).toEqual(list);
  });

  it("does not mutate the array it was given", () => {
    const original = [...list];
    moved(list, 0, 3);
    expect(list).toEqual(original);
  });

  it("handles a single-item list", () => {
    expect(moved(["only"], 0, 0)).toEqual(["only"]);
  });
});
