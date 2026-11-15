import { describe, expect, it } from "vitest";
import { reelRows } from "../../motion/TextLoop";

describe("the slot reel", () => {
  it("runs once round the reel and on to the next word, with a row above it to overshoot into", () => {
    // Item 0 to 1 of four: new word row 1, old word last, every word passes.
    expect(reelRows(0, 1, 4)).toEqual([2, 1, 0, 3, 2, 1, 0]);
    // Round the end of the list.
    expect(reelRows(3, 0, 4)).toEqual([1, 0, 3, 2, 1, 0, 3]);
  });

  it("puts the new word in row 1 and the old one last, whatever the jump", () => {
    for (let from = 0; from < 5; from++) {
      for (let to = 0; to < 5; to++) {
        if (to === from) continue;
        const rows = reelRows(from, to, 5);
        expect(rows[1]).toBe(to);
        expect(rows[rows.length - 1]).toBe(from);
        expect(rows[0]).toBe((to + 1) % 5);
      }
    }
  });
});
