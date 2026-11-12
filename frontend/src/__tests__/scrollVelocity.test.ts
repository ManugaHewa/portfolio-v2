import { describe, expect, it } from "vitest";
import { VelocityTracker } from "../lib/scrollVelocity";

describe("VelocityTracker", () => {
  it("reads 0 before the page has moved", () => {
    const v = new VelocityTracker();
    v.push(0, 0);
    expect(v.read(0)).toBe(0);
  });

  it("follows a steady scroll, signed by direction", () => {
    const down = new VelocityTracker();
    for (let i = 0; i <= 30; i++) down.push(i * 20, i * 16);
    expect(down.read(30 * 16)).toBeGreaterThan(1000);
    expect(down.read(30 * 16)).toBeLessThan(1300);

    const up = new VelocityTracker();
    for (let i = 0; i <= 30; i++) up.push(-i * 20, i * 16);
    expect(up.read(30 * 16)).toBeLessThan(-1000);
  });

  it("settles toward 0 once the scroll stops", () => {
    const v = new VelocityTracker();
    for (let i = 0; i <= 30; i++) v.push(i * 20, i * 16);
    const moving = v.read(480);
    expect(Math.abs(v.read(480 + 500))).toBeLessThan(Math.abs(moving) * 0.05);
  });

  it("ignores events with no time between them", () => {
    const v = new VelocityTracker();
    v.push(0, 100);
    v.push(500, 100);
    expect(v.read(100)).toBe(0);
  });
});
