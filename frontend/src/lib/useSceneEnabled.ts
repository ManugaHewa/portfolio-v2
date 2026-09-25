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

function allowed(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(MOTION_OK).matches;
}

export function useSceneEnabled(): boolean {
  const [enabled, setEnabled] = useState(allowed);

  useEffect(() => {
    const mq = window.matchMedia(MOTION_OK);
    const onChange = () => setEnabled(mq.matches);
    mq.addEventListener("change", onChange);
    // The first render read the same query, but a change landing between that
    // render and this effect would otherwise stick until the next one.
    onChange();
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return enabled;
}
