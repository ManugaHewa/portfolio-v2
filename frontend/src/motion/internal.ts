import { useContext, useSyncExternalStore } from "react";
import { MotionPauseContext, usePrefersReducedMotion } from "./hooks";

/**
 * Shared pieces for the primitives in this folder. Not exported from
 * ./index: nothing outside src/motion should need them.
 */

/** The site's one easing curve, the same as --ease-out in tokens.css. */
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

// Defined once in ./hooks (it is public: the app shell and the contact form
// use it too) and passed on here for the primitives that import it from here.
export { useIsomorphicLayoutEffect } from "./hooks";

/**
 * True when a one-off entrance should land on its finished values at once:
 * the visitor asked for reduced motion, or pressed "Pause motion". The
 * entrance still runs (so whatever started hidden is shown), only with
 * duration 0. That is how SPEC.md section 4 asks for it: the `initial` state
 * never changes, so the prerendered HTML and the first client render agree.
 */
export function useInstantMotion(): boolean {
  const reduced = usePrefersReducedMotion();
  const { paused } = useContext(MotionPauseContext);
  return reduced || paused;
}

const subscribeVisibility = (onChange: () => void) => {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
};

/**
 * Whether the tab is in front. Loops stop in a background tab: nobody is
 * watching, and the timer would otherwise pile up changes to replay.
 * Only effects read this, never render output, so the server's guess
 * ("visible") cannot cause a mismatch.
 */
export function usePageVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState !== "hidden",
    () => true,
  );
}

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
