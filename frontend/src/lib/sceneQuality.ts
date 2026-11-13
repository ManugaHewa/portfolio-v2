/**
 * Which WebGL scenes run on this device, when they are built, and how much
 * work each is allowed to do.
 *
 * Kept free of any Three import, so the gate (Scene.tsx, useSceneEnabled.ts)
 * can decide whether to fetch the Three chunk at all without loading it.
 */
export type SceneVariant = "core" | "corridor" | "globe" | "field" | "starfield" | "signal";

/**
 * The four scenes that sit behind a section. Each is built as its section
 * approaches and torn down once it has gone, so the page never holds more
 * than two or three GPU contexts at once. Mobile Safari drops contexts under
 * memory pressure, and a dropped context is a backdrop that silently
 * disappears, which is worse than one that costs a moment to build.
 *
 * The other two, the hero's wheel and the page-wide starfield, are on
 * screen from the first paint (or always, for the starfield), so they mount
 * once and stay.
 */
export const SECTION_SCENES: ReadonlySet<SceneVariant> = new Set<SceneVariant>([
  "field",
  "corridor",
  "globe",
  "signal",
]);

/**
 * Half a viewport ahead and behind. Far enough that a section scene has
 * finished building before its section scrolls in, near enough that a scene
 * is let go soon after its section leaves.
 */
export const APPROACH_MARGIN = "50% 0px";

/**
 * A touch screen or a phone-sized window. There, only the wheel and the
 * starfield run: the section backdrops are the most expendable GPU work on
 * the page, and the screen they would sit behind is mostly text anyway.
 */
export const SMALL_OR_TOUCH_QUERY = "(pointer: coarse), (max-width: 719.98px)";

export function mountsOnApproach(variant: SceneVariant): boolean {
  return SECTION_SCENES.has(variant);
}

export function sceneAllowed(variant: SceneVariant, smallOrTouch: boolean): boolean {
  return !smallOrTouch || !SECTION_SCENES.has(variant);
}

/**
 * The highest device pixel ratio any scene draws at. A phone commonly reports
 * 3, so a 400px canvas would otherwise become a 1200px drawing buffer. These
 * are soft, additive, part-transparent backdrops, and above 1.5 the extra
 * pixels cost fill rate (quadratically) without showing.
 */
export const MAX_PIXEL_RATIO = 1.5;

/**
 * The starfield is the one scene that is always on screen and the one with
 * the least to show per frame: a few hundred stars drifting a fraction of a
 * pixel a second. Ratio 1 and 30 frames a second look the same and halve
 * its cost twice over.
 */
const STARFIELD_PIXEL_RATIO = 1;
const STARFIELD_MAX_FPS = 30;

export interface SceneBudget {
  /** Upper bound for renderer.setPixelRatio. */
  pixelRatio: number;
  /** Multiplier for particle counts and geometry segments. */
  detail: number;
  /** MSAA is expensive on mobile GPUs and nearly invisible on these scenes. */
  antialias: boolean;
  /** Frames per second the loop may draw at; 0 means the display's own rate. */
  maxFps: number;
}

const PHONE = "(max-width: 719.98px)";
const NARROW = "(max-width: 1099.98px)";

export function sceneBudget(variant: SceneVariant = "core"): SceneBudget {
  const hasWindow = typeof window !== "undefined" && typeof window.matchMedia === "function";
  const dpr = hasWindow ? window.devicePixelRatio || 1 : 1;
  const starfield = variant === "starfield";

  const pixelRatio = Math.min(dpr, starfield ? STARFIELD_PIXEL_RATIO : MAX_PIXEL_RATIO);
  const maxFps = starfield ? STARFIELD_MAX_FPS : 0;

  // Geometry counts are the second lever after pixel ratio, sized to the
  // screen: a phone shows a scene a third the width of a desktop's.
  if (!hasWindow || window.matchMedia(PHONE).matches) {
    // The hero wheel is solid, fine-edged metalwork and printed numbers:
    // without antialiasing its edges stair-step, so it keeps it; the line
    // scenes can do without.
    return { pixelRatio, detail: 0.45, antialias: variant === "core", maxFps };
  }
  if (window.matchMedia(NARROW).matches) {
    return { pixelRatio, detail: 0.7, antialias: true, maxFps };
  }
  return { pixelRatio, detail: 1, antialias: true, maxFps };
}

/**
 * Scales a count for the budget without letting it collapse. A ring with three
 * segments is a triangle, and a scatter with two points is not a scatter, so
 * every call sets the floor below which the shape stops reading as itself.
 */
export function scaled(count: number, detail: number, min: number): number {
  return Math.max(min, Math.round(count * detail));
}
