import { useMediaQuery } from "../motion/hooks";
import { sceneAllowed, SMALL_OR_TOUCH_QUERY } from "./sceneQuality";
import type { SceneVariant } from "./sceneQuality";

/**
 * Whether a WebGL scene should exist on this device. No scene under reduced
 * motion, data saver, 2 GB of memory or less, or 2 cores or fewer; section
 * scenes also skip touch screens and windows under 720px. Saying no keeps
 * the Three chunk (133 kB gzipped) off the wire. The queries are live, and
 * false on the server and during hydration, so the prerender matches.
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
  // navigator is read only once motionOk, which is false on the server and while hydrating.
  return motionOk && sceneAllowed(variant, smallOrTouch) && deviceCanRunScene();
}
