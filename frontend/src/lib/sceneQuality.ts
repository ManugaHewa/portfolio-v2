/**
 * How much work the WebGL scenes are allowed to do on this device.
 *
 * An earlier pass simply switched the scenes off below 900px, which was the
 * cheap answer and the wrong one: the 3D layers are most of what the site looks
 * like, and a phone was getting a flat page. They run everywhere now, on a
 * budget that fits the hardware.
 *
 * Pixel ratio is the lever that matters. A phone commonly reports a DPR of 3,
 * so a 400px-wide canvas becomes a 1200px drawing buffer - and there are six
 * canvases. Capping the ratio cuts fill cost quadratically while barely showing
 * on a soft, additive-blended backdrop. Geometry counts come second, and
 * antialiasing is not worth its cost on a small screen at all.
 */
export interface SceneBudget {
  /** Upper bound for renderer.setPixelRatio. */
  pixelRatio: number;
  /** Multiplier for particle counts and geometry segments. */
  detail: number;
  /** MSAA is expensive on mobile GPUs and nearly invisible on these scenes. */
  antialias: boolean;
  /**
   * Whether a scene should be torn down while it is far from the viewport.
   * Six live contexts is a lot to ask of mobile Safari, which drops them under
   * memory pressure - and a dropped context is a backdrop that silently
   * disappears, which is worse than one that costs a moment to build.
   */
  mountOnApproach: boolean;
}

const PHONE = "(max-width: 760px)";
const NARROW = "(max-width: 1100px)";

const PHONE_BUDGET: SceneBudget = {
  pixelRatio: 1.5,
  detail: 0.45,
  antialias: false,
  mountOnApproach: true,
};

export function sceneBudget(): SceneBudget {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return PHONE_BUDGET;
  }

  const dpr = window.devicePixelRatio || 1;

  if (window.matchMedia(PHONE).matches) {
    return { ...PHONE_BUDGET, pixelRatio: Math.min(dpr, PHONE_BUDGET.pixelRatio) };
  }
  if (window.matchMedia(NARROW).matches) {
    return {
      pixelRatio: Math.min(dpr, 1.75),
      detail: 0.7,
      antialias: true,
      mountOnApproach: false,
    };
  }
  return { pixelRatio: Math.min(dpr, 2), detail: 1, antialias: true, mountOnApproach: false };
}

/**
 * Scales a count for the budget without letting it collapse. A ring with three
 * segments is a triangle, and a scatter with two points is not a scatter, so
 * every call sets the floor below which the shape stops reading as itself.
 */
export function scaled(count: number, detail: number, min: number): number {
  return Math.max(min, Math.round(count * detail));
}
