/**
 * How fast the page is scrolling, for the WebGL scenes: the starfield
 * stretches its stars into streaks with it, and the hero's wheel spins up.
 *
 * One passive scroll listener for the whole page, attached while at least
 * one scene is reading and removed when the last one stops. Scenes read it
 * inside their own render loop (readScrollVelocity), so nothing re-renders
 * React and nothing runs per scroll event beyond two numbers being stored.
 */

/** How quickly a reading follows a new speed (per second; higher is snappier). */
const FOLLOW = 18;
/** How quickly the reading falls away once the scroll events stop (ms). */
const SETTLE_MS = 160;

/**
 * Smoothed scroll speed in px/s, signed: positive while the page moves down
 * the document. Pure, so it can be tested without a browser.
 */
export class VelocityTracker {
  private lastY: number | null = null;
  private lastT = 0;
  private v = 0;

  push(y: number, t: number): void {
    if (this.lastY !== null && t > this.lastT) {
      const dt = (t - this.lastT) / 1000;
      const raw = (y - this.lastY) / dt;
      // Exponential smoothing that does not depend on the event rate.
      const k = 1 - Math.exp(-FOLLOW * dt);
      this.v += (raw - this.v) * k;
    }
    this.lastY = y;
    this.lastT = t;
  }

  /** The speed at time `t`, eased toward 0 for as long as no events came. */
  read(t: number): number {
    const quiet = Math.max(0, t - this.lastT);
    return this.v * Math.exp(-quiet / SETTLE_MS);
  }
}

let tracker: VelocityTracker | null = null;
let readers = 0;

const onScroll = () => tracker?.push(window.scrollY, performance.now());

/** Start reading; returns the function that stops. */
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

/** The current speed in px/s (0 when nothing is watching). */
export function readScrollVelocity(): number {
  return tracker ? tracker.read(performance.now()) : 0;
}
