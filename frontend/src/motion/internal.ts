import { useContext, useSyncExternalStore } from "react";
import { MotionPauseContext, usePrefersReducedMotion } from "./hooks";

/** Shared pieces for this folder's primitives; not exported from ./index. */

/** The site's easing curve (--ease-out in tokens.css). */
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

// Public in ./hooks; re-exported for the primitives.
export { useIsomorphicLayoutEffect } from "./hooks";

/**
 * True when one-off entrances should finish at once (reduced motion or
 * paused). They still run, with duration 0, and `initial` never changes,
 * so the prerender and first render match.
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
 * Whether the tab is in front; loops stop in background tabs. Read only in
 * effects, so the server's "visible" guess cannot cause a mismatch.
 */
export function usePageVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState !== "hidden",
    () => true,
  );
}

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
