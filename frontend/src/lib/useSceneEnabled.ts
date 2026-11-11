import { useMediaQuery } from "../motion/hooks";
import { sceneAllowed, SMALL_OR_TOUCH_QUERY } from "./sceneQuality";
import type { SceneVariant } from "./sceneQuality";

/**
 * Whether a WebGL scene should exist at all on this device. When the hero's
 * does not, the still image of the gyroscope stays in its place; the section
 * scenes simply leave their section's own background.
 *
 * - Someone asking their system for less motion: a slowly turning instrument
 *   is exactly the ambient motion that preference is about.
 * - Data saver on: the Three chunk is 133 kB gzipped for a decoration.
 * - A weak device: two gigabytes of memory or less, or two CPU cores or
 *   fewer. Browsers that do not report these are given the benefit of the
 *   doubt; sceneQuality.ts still sizes the work to the screen.
 * - A touch screen or a window under 720px: only the gyroscope and the
 *   starfield run there (sceneQuality.ts says why).
 *
 * mountScene checks the motion preference again before it touches WebGL, so
 * this is the outer of two layers. It earns its place by keeping the Three
 * chunk off the wire entirely rather than merely idle.
 *
 * Both queries are kept live, so changing the system setting or resizing the
 * window across 720px takes effect without a reload. Both are false on the
 * server and during hydration (useMediaQuery), so the prerendered HTML and
 * the browser's first render agree that there is no scene yet.
 */
const MOTION_OK = "(prefers-reduced-motion: no-preference)";

interface DeviceHints {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

export function deviceCanRunScene(nav: Navigator & DeviceHints = navigator as Navigator & DeviceHints): boolean {
  if (nav.connection?.saveData) return false;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 2) return false;
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency > 0 && nav.hardwareConcurrency <= 2) {
    return false;
  }
  return true;
}

export function useSceneEnabled(variant: SceneVariant = "core"): boolean {
  const motionOk = useMediaQuery(MOTION_OK);
  const smallOrTouch = useMediaQuery(SMALL_OR_TOUCH_QUERY);
  // The navigator is only read once motionOk is true, which never happens on
  // the server or during hydration.
  return motionOk && sceneAllowed(variant, smallOrTouch) && deviceCanRunScene();
}
