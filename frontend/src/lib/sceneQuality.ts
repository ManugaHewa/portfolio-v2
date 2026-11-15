/**
 * Which WebGL scenes run, when they are built and how much work they do.
 * No Three import, so the gate can decide before loading the Three chunk.
 */
export type SceneVariant = "core" | "corridor" | "globe" | "field" | "starfield" | "signal";

/**
 * Section backdrops: built as their section approaches and dropped after it
 * leaves, so only two or three GPU contexts exist at once (Mobile Safari
 * drops contexts under memory pressure). The wheel and starfield mount once.
 */
export const SECTION_SCENES: ReadonlySet<SceneVariant> = new Set<SceneVariant>([
  "field",
  "corridor",
  "globe",
  "signal",
]);

/** Half a viewport each way: built before the section arrives, freed soon after it leaves. */
export const APPROACH_MARGIN = "50% 0px";

/** Touch or phone-sized: only the wheel and the starfield run. */
export const SMALL_OR_TOUCH_QUERY = "(pointer: coarse), (max-width: 719.98px)";

export function mountsOnApproach(variant: SceneVariant): boolean {
  return SECTION_SCENES.has(variant);
}

export function sceneAllowed(variant: SceneVariant, smallOrTouch: boolean): boolean {
  return !smallOrTouch || !SECTION_SCENES.has(variant);
}

/**
 * Highest pixel ratio any scene draws at. Phones report 3; above 1.5 these
 * soft backdrops cost fill rate without visible gain.
 */
export const MAX_PIXEL_RATIO = 1.5;

/** The starfield drifts a fraction of a pixel a second: ratio 1 at 30 fps looks the same. */
const STARFIELD_PIXEL_RATIO = 1;
const STARFIELD_MAX_FPS = 30;

export interface SceneBudget {
  /** Cap for renderer.setPixelRatio. */
  pixelRatio: number;
  /** Multiplier for particle counts and geometry segments. */
  detail: number;
  /** MSAA: costly on mobile GPUs, barely visible here. */
  antialias: boolean;
  /** Frame cap; 0 = display rate. */
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

  // Geometry scales with screen width.
  if (!hasWindow || window.matchMedia(PHONE).matches) {
    // The wheel's fine edges stair-step without antialiasing; the line scenes do not.
    return { pixelRatio, detail: 0.45, antialias: variant === "core", maxFps };
  }
  if (window.matchMedia(NARROW).matches) {
    return { pixelRatio, detail: 0.7, antialias: true, maxFps };
  }
  return { pixelRatio, detail: 1, antialias: true, maxFps };
}

/** Scales a count by `detail`, never below `min` (where the shape stops reading). */
export function scaled(count: number, detail: number, min: number): number {
  return Math.max(min, Math.round(count * detail));
}
