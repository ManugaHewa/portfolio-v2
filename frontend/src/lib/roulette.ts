/**
 * The hero's roulette wheel as data: pocket order, bowl and head profiles,
 * and the ball's run from throw to pocket (callSpin for the Spin button).
 * Drawn by rouletteScene.ts; no Three, so it tests on its own.
 *
 * Scene units (the bowl is 3.6 across). Angles in radians, clockwise from
 * above. Head angle `a` sits at `a + W` in the world, W being the head's turn.
 */

/** Single-zero pockets, clockwise from 0. */
export const WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29,
  7, 28, 12, 35, 3, 26,
] as const;

export const POCKETS = WHEEL.length;
/** Angle per pocket. */
export const POCKET = (2 * Math.PI) / POCKETS;

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export type PocketInk = "zero" | "red" | "black";

/** A number's colour on the wheel. */
export function pocketInk(n: number): PocketInk {
  return n === 0 ? "zero" : RED.has(n) ? "red" : "black";
}

export const BALL_R = 0.045;

/*
 * Cross-sections as [radius, height], traced from the outer foot over the
 * top towards the axis, so Three's lathe faces them up.
 *
 * The fixed bowl: rim, wall, ball track, and the slope with the diamonds.
 */
export const BOWL_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [1.8, -0.18],
  [1.8, 0.16],
  [1.775, 0.205],
  [1.72, 0.22],
  [1.655, 0.21],
  [1.615, 0.17],
  [1.585, 0.11],
  [1.46, 0.075],
  [1.44, 0.07],
  [1.29, 0],
  [1.28, -0.06],
];

/* The turning head: rim, number ring, step into the pockets, pocket floor, cone to the turret. */
export const HEAD_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [1.27, -0.16],
  [1.27, -0.01],
  [1.12, -0.03],
  [1.11, -0.07],
  [0.86, -0.07],
  [0.85, -0.025],
  [0.7, 0.03],
  [0.5, 0.1],
  [0.3, 0.15],
  [0.16, 0.172],
  [0, 0.178],
];

/** Number ring, between the pockets and the head's rim. */
export const NUMBERS_R = [1.12, 1.27] as const;
/** Pockets, between the cone and the number ring; frets divide them. */
export const POCKETS_R = [0.86, 1.11] as const;

/** Radius of the ball's track. */
export const TRACK_R = 1.585 - BALL_R;
export const DIAMOND_R = 1.365;
export const HEAD_R = 1.27;
export const POCKET_R = 0.985;
/** Diamonds on the slope; the first at angle 0. */
export const DIAMONDS = 8;

// Surface the ball touches, inside out: pocket floor, number ring, head rim, gap, slope, track.
const SURFACE: ReadonlyArray<readonly [number, number]> = [
  [0.86, -0.07],
  [1.11, -0.07],
  [1.12, -0.03],
  [1.27, -0.01],
  [1.29, 0],
  [1.44, 0.07],
  [1.46, 0.075],
  [1.585, 0.11],
];

/** Surface height at radius `r`, and its outward slope. */
export function surfaceAt(r: number): { y: number; slope: number } {
  if (r <= SURFACE[0][0]) return { y: SURFACE[0][1], slope: 0 };
  for (let i = 1; i < SURFACE.length; i++) {
    const [r1, y1] = SURFACE[i];
    if (r <= r1) {
      const [r0, y0] = SURFACE[i - 1];
      const slope = (y1 - y0) / (r1 - r0);
      return { y: y0 + slope * (r - r0), slope };
    }
  }
  return { y: SURFACE[SURFACE.length - 1][1], slope: 0 };
}

const TAU = 2 * Math.PI;
const wrap = (a: number) => ((a % TAU) + TAU) % TAU;

/** Pocket index (into WHEEL) at a head angle. */
export function pocketAt(angle: number): number {
  return Math.min(POCKETS - 1, Math.floor(wrap(angle) / POCKET));
}

/** Head angle at the middle of pocket `i`. */
export const pocketCentre = (i: number) => (i + 0.5) * POCKET;

/* ------------------------------------------------------------- the ball */

/**
 * In the dealer's hand (waiting), round the track slowing (track), down the
 * slope, maybe off a diamond (drop), hopping across the frets (rattle), in
 * its pocket turning with the head (rest), picked out (lift).
 */
export type BallPhase = "waiting" | "track" | "drop" | "rattle" | "rest" | "lift";

/** One hop across the frets, in the head's frame. */
interface Hop {
  from: number;
  to: number;
  r0: number;
  r1: number;
  time: number;
  height: number;
}

export interface Ball {
  phase: BallPhase;
  /** Seconds into the phase. */
  t: number;
  /** World angle on the track and slope; head angle from the rattle on. */
  angle: number;
  /** Angular speed at the phase start, rad/s (track, drop). */
  v0: number;
  /** Phase length in seconds (waiting, rest, lift). */
  hold: number;
  /** Seconds into the drop when the ball hits a diamond, or -1. */
  hit: number;
  hops: Hop[];
  /** Resting pocket (index into WHEEL), or -1. */
  pocket: number;
  /** Spin asked for (lib/spin.ts) awaiting its throw, or 0. */
  call: number;
  /** Spin this run answers, or 0 for the wheel's own. */
  answers: number;
  /** Highest number an answering run may land on. */
  top: number;
  /** Lift start: distance from the axis and height above the surface. */
  liftR: number;
  liftAir: number;
}

export const RUN = {
  /** Throw speed range, rad/s. */
  launch: [7.4, 8.6] as const,
  /** Below this speed the ball leaves the wall. */
  leaves: 3.1,
  /** Track slowing: speed falls by e every `glide` seconds. */
  glide: 4.6,
  /** The same on the slope. */
  slide: 1.7,
  drop: 0.95,
  /** Time for the ball to grow into view after the throw. */
  appear: 0.25,
  /** How long a diamond knocks it up. */
  knock: 0.2,
  rest: [4.5, 6.5] as const,
  lift: 0.5,
  wait: [0.9, 1.4] as const,
  /** Softer throw for a called spin, so it lands sooner. */
  called: [5.6, 6.4] as const,
  /** Pick-up time when a called spin interrupts a run. */
  snatch: 0.3,
  /** Delay before the called throw. */
  soon: 0.2,
};

// Drop radius: slow at first, then fast.
const dropR = (u: number) => TRACK_R - (TRACK_R - HEAD_R) * u ** 1.7;

const between = (range: readonly [number, number], random: () => number) =>
  range[0] + (range[1] - range[0]) * random();

/** A ball in the hand, thrown after `wait` seconds. */
export function newBall(wait = 0.6): Ball {
  return {
    phase: "waiting",
    t: 0,
    angle: 0,
    v0: 0,
    hold: wait,
    hit: -1,
    hops: [],
    pocket: -1,
    call: 0,
    answers: 0,
    top: POCKETS - 1,
    liftR: POCKET_R,
    liftAir: 0,
  };
}

/**
 * Nearest pocket to `natural` (unwrapped index) numbered `top` or lower,
 * searching outward, the ball's way first. Every pocket is within two of
 * one numbered 0 to 13, so the path barely changes.
 */
export function steerPocket(natural: number, dir: number, top: number): number {
  for (let d = 0; d < POCKETS; d++) {
    for (const j of d === 0 ? [natural] : [natural + dir * d, natural - dir * d]) {
      if (WHEEL[((j % POCKETS) + POCKETS) % POCKETS] <= top) return j;
    }
  }
  return natural;
}

/** Angle travelled from t0 to t1, speed falling by e every `tau` seconds from v0. */
const glideAngle = (v0: number, tau: number, t0: number, t1: number) =>
  v0 * tau * (Math.exp(-t0 / tau) - Math.exp(-t1 / tau));

/** Angle, radius and speed `t` seconds into the drop. */
function dropAt(b: Ball, t: number) {
  return { angle: b.angle + glideAngle(b.v0, RUN.slide, 0, t), r: dropR(t / RUN.drop), speed: b.v0 * Math.exp(-t / RUN.slide) };
}

/**
 * Hops from the head to a pocket's middle: four or five, each covering
 * about half the remaining way, shorter and lower each time. Faster impacts
 * go further. With `top` >= 0, ends in the nearest pocket numbered `top` or lower.
 */
function planRattle(start: number, relSpeed: number, random: () => number, top = -1) {
  const dir = relSpeed < 0 ? -1 : 1;
  const way = Math.min(2.6, Math.max(0.9, Math.abs(relSpeed) * 0.55 + random() * 0.35));
  const natural = Math.floor((start + dir * way) / POCKET);
  const pocket = top >= 0 ? steerPocket(natural, dir, top) : natural;
  const end = pocketCentre(pocket);
  const count = random() < 0.5 ? 4 : 5;
  const weights = Array.from({ length: count }, (_, i) => 0.5 ** i);
  const total = weights.reduce((a, w) => a + w, 0);
  const hops: Hop[] = [];
  let at = start;
  weights.forEach((w, i) => {
    const to = i === count - 1 ? end : at + ((end - start) * w) / total;
    hops.push({
      from: at,
      to,
      r0: i === 0 ? HEAD_R : POCKET_R,
      r1: POCKET_R,
      time: 0.3 * 0.78 ** i,
      height: 0.08 * 0.55 ** i,
    });
    at = to;
  });
  return { hops, end, pocket: ((pocket % POCKETS) + POCKETS) % POCKETS };
}

/** Advances the ball `dt` seconds; a long step runs through several phases. `wheel` is the head's angle and speed. */
export function stepBall(
  ball: Ball,
  dt: number,
  wheel: { angle: number; speed: number },
  random: () => number = Math.random,
): Ball {
  const b: Ball = { ...ball };
  let left = dt;
  // A step crossing a phase end carries the rest into the next phase.
  for (let guard = 0; left > 1e-9 && guard < 12; guard++) {
    if (b.phase === "waiting" || b.phase === "rest" || b.phase === "lift") {
      const step = Math.min(left, b.hold - b.t);
      b.t += step;
      left -= step;
      if (b.t < b.hold) break;
      if (b.phase === "waiting") {
        b.phase = "track";
        b.angle = random() * Math.PI * 2;
        b.answers = b.call;
        b.call = 0;
        b.v0 = -between(b.answers ? RUN.called : RUN.launch, random);
      } else if (b.phase === "rest") {
        b.phase = "lift";
        b.hold = RUN.lift;
        b.liftR = POCKET_R;
        b.liftAir = 0;
      } else {
        b.phase = "waiting";
        b.hold = b.call ? RUN.soon : between(RUN.wait, random);
        b.pocket = -1;
        b.answers = 0;
      }
      b.t = 0;
    } else if (b.phase === "track") {
      const ends = RUN.glide * Math.log(Math.abs(b.v0) / RUN.leaves);
      const step = Math.min(left, ends - b.t);
      b.angle += glideAngle(b.v0, RUN.glide, b.t, b.t + step);
      b.t += step;
      left -= step;
      if (b.t < ends) break;
      b.phase = "drop";
      b.v0 = b.v0 * Math.exp(-ends / RUN.glide);
      b.t = 0;
      // Diamond hit? The ball crosses their ring once.
      const u = ((TRACK_R - DIAMOND_R) / (TRACK_R - HEAD_R)) ** (1 / 1.7);
      const crossing = u * RUN.drop;
      const at = wrap(dropAt(b, crossing).angle);
      const spacing = TAU / DIAMONDS;
      const off = Math.abs(at - Math.round(at / spacing) * spacing);
      b.hit = off < 0.07 ? crossing : -1;
    } else if (b.phase === "drop") {
      const step = Math.min(left, RUN.drop - b.t);
      b.t += step;
      left -= step;
      if (b.t < RUN.drop) break;
      const end = dropAt(b, RUN.drop);
      const start = end.angle - wheel.angle;
      const plan = planRattle(start, end.speed - wheel.speed, random, b.answers ? b.top : -1);
      b.phase = "rattle";
      b.angle = start;
      b.hops = plan.hops;
      b.pocket = plan.pocket;
      b.t = 0;
    } else {
      const total = b.hops.reduce((a, h) => a + h.time, 0);
      const step = Math.min(left, total - b.t);
      b.t += step;
      left -= step;
      if (b.t < total) break;
      b.phase = "rest";
      b.angle = b.hops[b.hops.length - 1].to;
      b.hold = between(RUN.rest, random);
      b.hops = [];
      b.t = 0;
    }
  }
  return b;
}

export interface BallPose {
  /** Distance from the axis. */
  r: number;
  /** Height of the ball's centre. */
  y: number;
  /** World angle. */
  angle: number;
  /** 0 hidden, 1 full size. */
  scale: number;
  /** Height above the surface, for the shadow. */
  air: number;
  /** World angular speed, rad/s, for the blur. */
  speed: number;
}

const easeOut = (k: number) => 1 - (1 - k) ** 3;
const easeIn = (k: number) => k * k * k;

/** Where to draw the ball, given the head's angle and speed. */
export function ballPose(b: Ball, wheel: number, wheelSpeed: number): BallPose {
  const on = (r: number, angle: number, air = 0, scale = 1, speed = 0): BallPose => ({
    r,
    y: surfaceAt(r).y + BALL_R + air,
    angle,
    scale,
    air,
    speed,
  });
  switch (b.phase) {
    case "waiting":
      return on(TRACK_R, b.angle, 0, 0);
    case "track":
      return on(TRACK_R, b.angle, 0, easeOut(Math.min(1, b.t / RUN.appear)), b.v0 * Math.exp(-b.t / RUN.glide));
    case "drop": {
      const d = dropAt(b, b.t);
      const k = b.hit >= 0 ? (b.t - b.hit) / RUN.knock : -1;
      const air = k > 0 && k < 1 ? 0.06 * Math.sin(Math.PI * k) : 0;
      return on(d.r, d.angle, air, 1, d.speed);
    }
    case "rattle": {
      let t = b.t;
      for (const h of b.hops) {
        if (t <= h.time) {
          const u = t / h.time;
          const r = h.r0 + (h.r1 - h.r0) * u;
          // Ground under the arc, from take-off to landing.
          const ground = surfaceAt(h.r0).y + (surfaceAt(h.r1).y - surfaceAt(h.r0).y) * u;
          const air = h.height * 4 * u * (1 - u);
          return {
            r,
            y: ground + BALL_R + air,
            angle: h.from + (h.to - h.from) * u + wheel,
            scale: 1,
            air: ground + air - surfaceAt(r).y,
            speed: (h.to - h.from) / h.time + wheelSpeed,
          };
        }
        t -= h.time;
      }
      const last = b.hops[b.hops.length - 1];
      return on(POCKET_R, (last ? last.to : b.angle) + wheel, 0, 1, wheelSpeed);
    }
    case "rest":
      return on(POCKET_R, b.angle + wheel, 0, 1, wheelSpeed);
    case "lift": {
      const k = easeIn(Math.min(1, b.t / Math.max(1e-6, b.hold)));
      return on(b.liftR, b.angle + wheel, b.liftAir + 0.28 * k, 1 - k, wheelSpeed);
    }
  }
}

/**
 * Calls spin `id` (lib/spin.ts): the next throw lands on 0..top. In the
 * hand, it is thrown at once; resting, lifted out; mid-run, snatched where
 * it is. `wheel` is the head's angle and speed.
 */
export function callSpin(ball: Ball, id: number, top: number, wheel: { angle: number; speed: number }): Ball {
  const b: Ball = { ...ball, call: id, top };
  switch (ball.phase) {
    case "waiting":
      return { ...b, hold: Math.min(ball.hold, ball.t + RUN.soon) };
    case "lift":
      return b;
    case "rest":
      return { ...b, phase: "lift", t: 0, hold: RUN.lift, liftR: POCKET_R, liftAir: 0 };
    default: {
      const p = ballPose(ball, wheel.angle, wheel.speed);
      return {
        ...b,
        phase: "lift",
        t: 0,
        hold: RUN.snatch,
        angle: p.angle - wheel.angle,
        liftR: p.r,
        liftAir: p.air,
        hops: [],
        hit: -1,
        pocket: -1,
        answers: 0,
      };
    }
  }
}
