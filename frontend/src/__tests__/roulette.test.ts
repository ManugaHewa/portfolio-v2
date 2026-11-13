import { describe, expect, it } from "vitest";
import {
  BALL_R,
  POCKET,
  POCKETS,
  WHEEL,
  ballPose,
  callSpin,
  newBall,
  pocketAt,
  pocketInk,
  steerPocket,
  stepBall,
  surfaceAt,
} from "../lib/roulette";
import type { Ball, BallPhase } from "../lib/roulette";

/** A repeatable source of chance (an LCG), so each run is the same run. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Plays the wheel at 60 frames a second, the head turning at `speed`. */
function play(seconds: number, seed: number, speed = 0.5) {
  const random = seeded(seed);
  const frames: Array<{ ball: Ball; x: number; y: number; z: number; scale: number }> = [];
  let ball = newBall();
  let wheel = 0;
  const dt = 1 / 60;
  for (let i = 0; i < seconds * 60; i++) {
    wheel += speed * dt;
    ball = stepBall(ball, dt, { angle: wheel, speed }, random);
    const p = ballPose(ball, wheel, speed);
    frames.push({ ball, x: p.r * Math.cos(p.angle), y: p.y, z: p.r * Math.sin(p.angle), scale: p.scale });
  }
  return frames;
}

describe("the wheel", () => {
  it("has the 37 numbers once each, red and black alternating after the zero", () => {
    expect(new Set(WHEEL).size).toBe(37);
    expect(Math.max(...WHEEL)).toBe(36);
    expect(pocketInk(WHEEL[0])).toBe("zero");
    for (let i = 1; i < WHEEL.length; i++) {
      expect(pocketInk(WHEEL[i])).toBe(i % 2 === 1 ? "red" : "black");
    }
  });

  it("finds the pocket under any angle, the whole way round and past it", () => {
    expect(pocketAt(0.1 * POCKET)).toBe(0);
    expect(pocketAt(2.5 * POCKET)).toBe(2);
    expect(pocketAt(-0.5 * POCKET)).toBe(POCKETS - 1);
    expect(pocketAt(2 * Math.PI + 3.5 * POCKET)).toBe(3);
  });
});

describe("the ball", () => {
  it("comes to rest in the middle of the pocket it reports, run after run", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const frames = play(40, seed);
      const rests = frames.filter((f, i) => f.ball.phase === "rest" && frames[i - 1]?.ball.phase !== "rest");
      expect(rests.length).toBeGreaterThanOrEqual(2);
      for (const { ball } of rests) {
        const into = (((ball.angle % POCKET) + POCKET) % POCKET) / POCKET;
        expect(into).toBeCloseTo(0.5, 6);
        expect(pocketAt(ball.angle)).toBe(ball.pocket);
      }
    }
  });

  it("goes round the whole run in order, again and again", () => {
    const order: BallPhase[] = ["waiting", "track", "drop", "rattle", "rest", "lift"];
    const seen: BallPhase[] = [];
    for (const f of play(40, 9)) if (seen[seen.length - 1] !== f.ball.phase) seen.push(f.ball.phase);
    expect(seen.length).toBeGreaterThan(order.length);
    seen.forEach((phase, i) => expect(phase).toBe(order[i % order.length]));
  });

  it("never jumps between frames while it is in view", () => {
    for (const seed of [11, 12, 13]) {
      const frames = play(30, seed, 1.4);
      for (let i = 1; i < frames.length; i++) {
        const a = frames[i - 1];
        const b = frames[i];
        if (a.scale === 0 || b.scale === 0) continue;
        expect(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)).toBeLessThan(0.25);
      }
    }
  });

  it("rolls on the surface, never through it", () => {
    for (const f of play(30, 21)) {
      if (f.scale === 0) continue;
      const r = Math.hypot(f.x, f.z);
      expect(f.y).toBeGreaterThanOrEqual(surfaceAt(r).y + BALL_R - 1e-6);
    }
  });

  it("covers a long step as several short ones would", () => {
    const still = { angle: 0, speed: 0 };
    const once = stepBall(newBall(0), 8, still, seeded(5));
    const random = seeded(5);
    let often = newBall(0);
    for (let i = 0; i < 480; i++) often = stepBall(often, 1 / 60, still, random);
    expect(once.phase).toBe("rest");
    expect(often.phase).toBe("rest");
    expect(once.pocket).toBe(often.pocket);
    expect(once.angle).toBeCloseTo(often.angle, 6);
  });
});

describe("a spin asked for", () => {
  const ASK = 7;
  const TOP = 13;

  /** Plays the wheel with a spin asked for `askAt` seconds in. */
  function playAsked(seconds: number, seed: number, askAt: number, speed = 0.5) {
    const random = seeded(seed);
    const frames: Array<{ t: number; ball: Ball; x: number; y: number; z: number; scale: number }> = [];
    let ball = newBall();
    let wheel = 0;
    const dt = 1 / 60;
    const at = Math.round(askAt * 60);
    for (let i = 0; i < seconds * 60; i++) {
      if (i === at) ball = callSpin(ball, ASK, TOP, { angle: wheel, speed });
      wheel += speed * dt;
      ball = stepBall(ball, dt, { angle: wheel, speed }, random);
      const p = ballPose(ball, wheel, speed);
      frames.push({ t: (i + 1) * dt, ball, x: p.r * Math.cos(p.angle), y: p.y, z: p.r * Math.sin(p.angle), scale: p.scale });
    }
    return frames;
  }

  it("steers to the nearest pocket the deck holds, at most two either way", () => {
    for (let natural = -40; natural < 80; natural++) {
      for (const dir of [-1, 1]) {
        const j = steerPocket(natural, dir, TOP);
        expect(WHEEL[((j % POCKETS) + POCKETS) % POCKETS]).toBeLessThanOrEqual(TOP);
        expect(Math.abs(j - natural)).toBeLessThanOrEqual(2);
      }
    }
  });

  it("is answered by a throw that lands on 0 to 13, in whatever phase it is asked", () => {
    const phases = new Set<BallPhase>();
    for (const seed of [1, 2, 3, 4]) {
      for (let askAt = 0.2; askAt < 13; askAt += 0.6) {
        const frames = playAsked(22, seed, askAt);
        phases.add(frames[Math.round(askAt * 60) - 1].ball.phase);
        const answer = frames.find((f) => f.ball.phase === "rest" && f.ball.answers === ASK);
        expect(answer).toBeDefined();
        if (!answer) continue;
        expect(WHEEL[answer.ball.pocket]).toBeLessThanOrEqual(TOP);
        // Picked up, thrown softly, and in its pocket within six seconds.
        expect(answer.t - askAt).toBeLessThan(6.5);
      }
    }
    // Every phase of the run was asked in at least once.
    expect([...phases].sort()).toEqual(["drop", "lift", "rattle", "rest", "track", "waiting"]);
  });

  it("picks the ball up where it is, without a jump", () => {
    for (const seed of [5, 6, 7]) {
      for (const askAt of [1.2, 3.1, 5.3, 6.0]) {
        const frames = playAsked(10, seed, askAt, 1.1);
        for (let i = 1; i < frames.length; i++) {
          const a = frames[i - 1];
          const b = frames[i];
          if (a.scale === 0 || b.scale === 0) continue;
          expect(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)).toBeLessThan(0.25);
        }
      }
    }
  });

  it("leaves the wheel's own runs to land on any number", () => {
    const landed = new Set<number>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      for (const f of play(60, seed)) if (f.ball.phase === "rest") landed.add(WHEEL[f.ball.pocket]);
    }
    expect([...landed].some((n) => n > TOP)).toBe(true);
  });
});
