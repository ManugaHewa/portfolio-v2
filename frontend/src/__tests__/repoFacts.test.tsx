import { describe, expect, it } from "vitest";
import { commitGrid } from "../components/CommitStrip";
import { dockFrame } from "../components/Hero";
import { hashKey, hideConstellation, readConstellation, showConstellation } from "../lib/constellation";
import { excerpt, tokenize } from "../../build/repoFacts";
import { COMMIT_DAYS } from "virtual:commit-log";

describe("commitGrid", () => {
  it("lays days out a column per week from the Sunday before the first commit", () => {
    // 2026-09-16 was a Wednesday.
    const g = commitGrid([
      ["2026-09-16", 1],
      ["2026-09-20", 4],
    ])!;
    expect(g.cells[0].day).toBe("2026-09-13");
    expect(g.cells[3]).toMatchObject({ day: "2026-09-16", count: 1, week: 0, weekday: 3, level: 1 });
    expect(g.cells.at(-1)).toMatchObject({ day: "2026-09-20", week: 1, weekday: 0, level: 4 });
    expect(g.weeks).toBe(2);
    expect(g.total).toBe(5);
    expect(g.activeDays).toBe(2);
  });

  it("has nothing to draw without a log", () => {
    expect(commitGrid([])).toBeNull();
  });

  it("is built from this repository's real history", () => {
    expect(COMMIT_DAYS.length).toBeGreaterThan(0);
    for (const [day, n] of COMMIT_DAYS) {
      expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(n).toBeGreaterThan(0);
    }
  });
});

describe("dockFrame", () => {
  const from = { x: 1000, y: 400, size: 360 };
  const to = { x: 80, y: 32, size: 26 };
  it("starts on the hero's wheel and ends on the header's mark", () => {
    expect(dockFrame(0, from, to)).toEqual(from);
    const end = dockFrame(1, from, to);
    expect(end.x).toBeCloseTo(to.x, 6);
    expect(end.y).toBeCloseTo(to.y, 6);
    expect(end.size).toBeCloseTo(to.size, 6);
  });

  it("bows up on the way, above the straight line", () => {
    const mid = dockFrame(0.5, from, to);
    expect(mid.y).toBeLessThan((from.y + to.y) / 2);
  });
});

describe("constellations", () => {
  it("keeps a later hover when an earlier one leaves", () => {
    showConstellation("dms", 10);
    showConstellation("exercise", 16);
    hideConstellation("dms");
    expect(readConstellation()).toEqual({ key: "exercise", count: 16 });
    hideConstellation("exercise");
    expect(readConstellation()).toBeNull();
  });

  it("gives a project the same shape every time", () => {
    expect(hashKey("dms")).toBe(hashKey("dms"));
    expect(hashKey("dms")).not.toBe(hashKey("exercise"));
  });
});

describe("code peek tokenizer", () => {
  it("marks keywords, strings, comments, numbers and calls", () => {
    expect(tokenize('const x = load("a", 2); // note')).toEqual([
      ["kw", "const"],
      ["txt", " x = "],
      ["fn", "load"],
      ["txt", "("],
      ["str", '"a"'],
      ["txt", ", "],
      ["num", "2"],
      ["txt", "); "],
      ["com", "// note"],
    ]);
  });

  it("reads a shell comment but not a # inside a word", () => {
    expect(tokenize("# seed the db")).toEqual([["com", "# seed the db"]]);
    expect(tokenize("a#b")).toEqual([["txt", "a#b"]]);
  });

  it("starts at the anchor, numbers the lines and fails loudly when the anchor is gone", () => {
    const src = "one\n  two\n    three\n  four";
    const e = excerpt(src, { file: "f.ts", find: "two", lines: 2 });
    expect(e.start).toBe(2);
    expect(e.lines.map((l) => l.map(([, t]) => t).join(""))).toEqual(["two", "  three"]);
    expect(() => excerpt(src, { file: "f.ts", find: "five", lines: 1 })).toThrow(/no longer in f.ts/);
  });
});
