/**
 * Page scroll speed for the WebGL scenes (starfield streaks, wheel spin-up).
 * One passive listener, attached while any scene reads it. Scenes poll it in
 * their render loop, so React never re-renders.
 */

/** Smoothing rate toward a new speed, per second. */
const FOLLOW = 18;
/** Decay time once scroll events stop (ms). */
const SETTLE_MS = 160;

/** Smoothed, signed scroll speed in px/s (positive = down). Pure, for tests. */
export class VelocityTracker {
  private lastY: number | null = null;
  private lastT = 0;
  private v = 0;

  push(y: number, t: number): void {
    if (this.lastY !== null && t > this.lastT) {
      const dt = (t - this.lastT) / 1000;
      const raw = (y - this.lastY) / dt;
      // Exponential smoothing, independent of event rate.
      const k = 1 - Math.exp(-FOLLOW * dt);
      this.v += (raw - this.v) * k;
    }
    this.lastY = y;
    this.lastT = t;
  }

  /** Speed at time `t`, decaying toward 0 while no events arrive. */
  read(t: number): number {
    const quiet = Math.max(0, t - this.lastT);
    return this.v * Math.exp(-quiet / SETTLE_MS);
  }
}

let tracker: VelocityTracker | null = null;
let readers = 0;

const onScroll = () => tracker?.push(window.scrollY, performance.now());

/** Starts reading; returns a stop function. */
export function watchScrollVelocity(): () => void {
  if (readers++ === 0) {
    tracker = new VelocityTracker();
    tracker.push(window.scrollY, performance.now());
    window.addEventListener("scroll", onScroll, { passive: true });
  }
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    if (--readers === 0) {
      window.removeEventListener("scroll", onScroll);
      tracker = null;
    }
  };
}

/** Current speed in px/s; 0 when nothing is watching. */
export function readScrollVelocity(): number {
  return tracker ? tracker.read(performance.now()) : 0;
}
