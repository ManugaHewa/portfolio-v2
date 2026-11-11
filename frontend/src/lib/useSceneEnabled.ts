import { useEffect, useState } from "react";

/**
 * Whether the WebGL gyroscope should run at all. When it does not, the still
 * image of it stays in its place.
 *
 * - Someone asking their system for less motion: a slowly turning instrument
 *   is exactly the ambient motion that preference is about.
 * - Data saver on: the Three chunk is 133 kB gzipped for a decoration.
 * - A weak device: two gigabytes of memory or less, or two CPU cores or
 *   fewer. Browsers that do not report these are given the benefit of the
 *   doubt; sceneQuality.ts still sizes the work to the screen.
 *
 * mountScene checks the motion preference again before it touches WebGL, so
 * this is the outer of two layers. It earns its place by keeping the Three
 * chunk off the wire entirely rather than merely idle.
 *
 * The preference is read as a media query rather than once, so toggling the
 * system setting takes effect without a reload.
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

export function useSceneEnabled(): boolean {
  // Starts false everywhere and is decided in the effect below, never during
  // the first render: the prerendered HTML has no scene in it, so the
  // browser's first render must not either, or hydration fails.
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function" || !deviceCanRunScene()) return;
    const mq = window.matchMedia(MOTION_OK);
    const onChange = () => setEnabled(mq.matches);
    mq.addEventListener("change", onChange);
    onChange();
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return enabled;
}
