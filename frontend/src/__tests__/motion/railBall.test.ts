import { describe, expect, it } from "vitest";
import { railBall } from "../../motion/IndexRail";

describe("the rail's ball", () => {
  const pockets = [0.1, 0.4, 0.6, 1];

  it("sits in a pocket while the page passes it", () => {
    for (const p of [0.1, 0.12, 0.4, 0.43, 0.38, 0.6, 1]) {
      const near = pockets.reduce((a, b) => (Math.abs(b - p) < Math.abs(a - p) ? b : a));
      const ball = railBall(p, pockets);
      expect(ball.at).toBeCloseTo(near, 9);
      expect(ball.seat).toBe(1);
    }
  });

  it("rolls out on the track between two, quickest halfway", () => {
    const mid = railBall(0.25, pockets);
    expect(mid.at).toBeCloseTo(0.25, 9);
    expect(mid.seat).toBe(0);
    const a = railBall(0.24, pockets).at;
    const b = railBall(0.26, pockets).at;
    const c = railBall(0.31, pockets).at;
    const d = railBall(0.33, pockets).at;
    expect(b - a).toBeGreaterThan(d - c);
  });

  it("only ever moves forward as the page does, and never jumps", () => {
    let last = railBall(0, pockets);
    for (let i = 1; i <= 2000; i++) {
      const ball = railBall(i / 2000, pockets);
      expect(ball.at).toBeGreaterThanOrEqual(last.at - 1e-12);
      expect(Math.abs(ball.at - last.at)).toBeLessThan(0.004);
      expect(Math.abs(ball.seat - last.seat)).toBeLessThan(0.1);
      last = ball;
    }
  });

  it("with no pockets measured, simply follows the page", () => {
    expect(railBall(0.37, [])).toEqual({ at: 0.37, seat: 0 });
  });
});
