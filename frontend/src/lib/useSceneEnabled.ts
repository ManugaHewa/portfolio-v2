import { useEffect, useState } from "react";

/**
 * Whether the WebGL layers should run at all.
 *
 * Only one thing switches them off now: someone asking their system for less
 * motion. Screen size does not, because the 3D layers are most of what this
 * site looks like and gating them on width meant a phone got a flat page. What
 * a small screen gets instead is a smaller budget - see sceneQuality.ts.
 *
 * mountScene checks the same preference before it touches WebGL, so this is the
 * outer of two layers. It earns its place by keeping the Three chunk, 133 kB
 * gzipped, off the wire entirely rather than merely idle.
 *
 * Read as a media query rather than a one-off check so that toggling the system
 * setting takes effect without a reload.
 */
const MOTION_OK = "(prefers-reduced-motion: no-preference)";

export function useSceneEnabled(): boolean {
  // Starts false everywhere and is decided in the effect below, never during
  // the first render: the prerendered HTML has no scenes in it, so the
  // browser's first render must not either, or hydration fails. The cost is
  // one frame before the lazy Three chunk is requested.
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(MOTION_OK);
    const onChange = () => setEnabled(mq.matches);
    mq.addEventListener("change", onChange);
    onChange();
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return enabled;
}
