import { describe, expect, it } from "vitest";
import { STACK_STEP, coverage, stickTop } from "../components/work/useCaseStack";

describe("the case-study deck", () => {
  it("sticks each card a step lower than the one before", () => {
    expect(stickTop(1) - stickTop(0)).toBe(STACK_STEP);
    expect(stickTop(5) - stickTop(0)).toBe(5 * STACK_STEP);
  });

  it("counts a card uncovered until the next reaches its bottom edge, and fully covered at rest", () => {
    const top = stickTop(0);
    const h = 560;
    expect(coverage(top, h, top + h + 200)).toBe(0);
    expect(coverage(top, h, top + h)).toBe(0);
    expect(coverage(top, h, top + STACK_STEP)).toBe(1);
    const half = coverage(top, h, top + STACK_STEP + (h - STACK_STEP) / 2);
    expect(half).toBeCloseTo(0.5, 5);
  });
});
