/**
 * The hero's roulette wheel as numbers: the pockets in wheel order, the
 * shape of the bowl and of the wheel head, and the ball's run from the
 * throw to its pocket. Scene3D.tsx ("core") draws it. Free of Three, so the
 * ball can be tested on its own.
 *
 * Distances are scene units (the bowl is 3.6 across). Angles are radians
 * about the wheel's axis, increasing clockwise as seen from above. A point at
 * angle `a` on the wheel head is at `a + W` in the world, where W is how far
 * the head has turned.
 */

/** The single-zero wheel's pockets, clockwise from the zero. */
export const WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29,
  7, 28, 12, 35, 3, 26,
] as const;

export const POCKETS = WHEEL.length;
/** One pocket's share of the turn. */
export const POCKET = (2 * Math.PI) / POCKETS;

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export type PocketInk = "zero" | "red" | "black";

/** A number's colour on the wheel. Around the wheel, red and black alternate after the zero. */
export function pocketInk(n: number): PocketInk {
  return n === 0 ? "zero" : RED.has(n) ? "red" : "black";
}

export const BALL_R = 0.045;

/*
 * Cross-sections, [radius, height], each traced from its outer foot up and
 * over its top surface towards the axis: Three's lathe faces a profile
 * traced that way up, towards the camera.
 *
 * The bowl stands still: a rim, a short wall the ball runs against, the
 * ball track, and the slope down to the wheel head, where the diamonds sit.
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

/*
 * The wheel head turns: its rim, the number ring (drawn over this as its own
 * textured ring), the step down into the pockets, the pockets' floor, and
 * the cone rising to the turret.
 */
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

/** The number ring, between the pockets and the head's rim. */
export const NUMBERS_R = [1.12, 1.27] as const;
/** The pockets, between the cone and the number ring; frets divide them. */
export const POCKETS_R = [0.86, 1.11] as const;

/** Where the ball runs. */
export const TRACK_R = 1.585 - BALL_R;
export const DIAMOND_R = 1.365;
export const HEAD_R = 1.27;
export const POCKET_R = 0.985;
/** Eight diamonds on the slope, the first at angle 0. */
export const DIAMONDS = 8;

// The surface the ball can touch, inside out: the pockets' floor, the
// number ring, the head's rim, the gap, the slope, the track.
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

/** The height of the surface under the ball at radius `r`, and how steeply it rises outward. */
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

/** The pocket (an index into WHEEL) that an angle on the wheel head falls in. */
export function pocketAt(angle: number): number {
  return Math.min(POCKETS - 1, Math.floor(wrap(angle) / POCKET));
}

/** The middle of pocket `i`, as an angle on the wheel head. */
export const pocketCentre = (i: number) => (i + 0.5) * POCKET;

/* ------------------------------------------------------------- the ball */

/**
 * The run, in phases: hidden in the dealer's hand ("waiting"); thrown round
 * the track, slowing ("track"); too slow to hold the wall, down the slope,
 * over a diamond if it meets one ("drop"); onto the turning head and across
 * the frets in shorter and lower hops ("rattle"); in its pocket, turning
 * with the head ("rest"); picked out again ("lift").
 */
export type BallPhase = "waiting" | "track" | "drop" | "rattle" | "rest" | "lift";

/** One hop across the frets, in the wheel head's frame. */
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
  /** In the world on the track and the slope; on the wheel head from the rattle on. */
  angle: number;
  /** The angular speed the phase started at, radians a second (track, drop). */
  v0: number;
  /** How long this phase lasts (waiting, rest), seconds. */
  hold: number;
  /** Seconds into the drop when the ball meets a diamond, or -1. */
  hit: number;
  hops: Hop[];
  /** Where it came to rest (an index into WHEEL), or -1. */
  pocket: number;
}

export const RUN = {
  /** The throw's speed, radians a second, as a range. */
  launch: [7.4, 8.6] as const,
  /** The ball leaves the wall below this speed. */
  leaves: 3.1,
  /** How quickly it slows on the track: speed falls by e every `glide` seconds. */
  glide: 4.6,
  /** The same on the slope. */
  slide: 1.7,
  drop: 0.95,
  /** The ball grows into view this long after the throw. */
  appear: 0.25,
  /** How long a diamond knocks it up for. */
  knock: 0.2,
  rest: [4.5, 6.5] as const,
  lift: 0.5,
  wait: [0.9, 1.4] as const,
};

// How the drop draws the ball in: slowly at first, then quickly.
const dropR = (u: number) => TRACK_R - (TRACK_R - HEAD_R) * u ** 1.7;

const between = (range: readonly [number, number], random: () => number) =>
  range[0] + (range[1] - range[0]) * random();

/** A ball still in the hand, thrown after `wait` seconds. */
export function newBall(wait = 0.6): Ball {
  return { phase: "waiting", t: 0, angle: 0, v0: 0, hold: wait, hit: -1, hops: [], pocket: -1 };
}

/** Angle travelled from t0 to t1 at a speed that falls by e every `tau` seconds from v0. */
const glideAngle = (v0: number, tau: number, t0: number, t1: number) =>
  v0 * tau * (Math.exp(-t0 / tau) - Math.exp(-t1 / tau));

/** Where the ball is `t` seconds into its drop, and how fast it is going round. */
function dropAt(b: Ball, t: number) {
  return { angle: b.angle + glideAngle(b.v0, RUN.slide, 0, t), r: dropR(t / RUN.drop), speed: b.v0 * Math.exp(-t / RUN.slide) };
}

/**
 * The hops from where the ball reaches the head to its pocket: four or five,
 * each covering about half the way that is left, shorter and lower each
 * time, ending in the middle of a pocket. Further, the faster the ball meets
 * the head (it is going against the head's turn).
 */
function planRattle(start: number, relSpeed: number, random: () => number) {
  const dir = relSpeed < 0 ? -1 : 1;
  const way = Math.min(2.6, Math.max(0.9, Math.abs(relSpeed) * 0.55 + random() * 0.35));
  const pocket = Math.floor((start + dir * way) / POCKET);
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

/**
 * The ball `dt` seconds on. `wheel` is the head's angle and speed now;
 * `random` is the source of chance (Math.random on the page). A long step
 * runs through as many phases as it covers.
 */
export function stepBall(
  ball: Ball,
  dt: number,
  wheel: { angle: number; speed: number },
  random: () => number = Math.random,
): Ball {
  const b: Ball = { ...ball };
  let left = dt;
  // Phases end at exact times; a step that covers an end carries on into the
  // next phase with what is left of it.
  for (let guard = 0; left > 1e-9 && guard < 12; guard++) {
    if (b.phase === "waiting" || b.phase === "rest" || b.phase === "lift") {
      const length = b.phase === "lift" ? RUN.lift : b.hold;
      const step = Math.min(left, length - b.t);
      b.t += step;
      left -= step;
      if (b.t < length) break;
      if (b.phase === "waiting") {
        b.phase = "track";
        b.angle = random() * Math.PI * 2;
        b.v0 = -between(RUN.launch, random);
      } else if (b.phase === "rest") {
        b.phase = "lift";
      } else {
        b.phase = "waiting";
        b.hold = between(RUN.wait, random);
        b.pocket = -1;
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
      // Whether the ball meets a diamond on the way down: it crosses their
      // ring once, and meets one if it crosses where one stands.
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
      const plan = planRattle(start, end.speed - wheel.speed, random);
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
  /** 0 hidden to 1 in full view. */
  scale: number;
  /** How far above the surface it is, for its shadow. */
  air: number;
  /** World angular speed, radians a second, for its blur. */
  speed: number;
}

const easeOut = (k: number) => 1 - (1 - k) ** 3;
const easeIn = (k: number) => k * k * k;

/** Where to draw the ball, given where the wheel head is (`wheel`) and how fast it turns. */
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
          // The surface under the arc runs from where it left to where it lands.
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
      const k = easeIn(Math.min(1, b.t / RUN.lift));
      return on(POCKET_R, b.angle + wheel, 0.28 * k, 1 - k, wheelSpeed);
    }
  }
}
