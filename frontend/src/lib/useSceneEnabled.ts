import { useEffect, useState } from "react";

/**
 * Whether this device should run the WebGL layers at all.
 *
 * The page carries six of them and each one is a separate renderer holding its
 * own GPU context. On a laptop that is atmosphere. On a phone it is six
 * contexts, a 133 kB gzipped Three chunk over a mobile connection, and a render
 * loop competing with scrolling for the main thread - on the hardware least
 * able to absorb any of it.
 *
 * Skipping them costs a small screen nothing it can see. Every scene already
 * sits behind a CSS layer that is the immediate paint, so the section looks
 * finished whether or not the chunk ever lands; that was true before this gate
 * existed, because the scenes are lazy and could always fail to load.
 *
 * Read as a media query rather than a one-off width check so that rotating a
 * tablet, or dragging a desktop window narrow, actually takes effect.
 */
const CAPABLE = "(min-width: 900px) and (prefers-reduced-motion: no-preference)";

function capable(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(CAPABLE).matches;
}

export function useSceneEnabled(): boolean {
  const [enabled, setEnabled] = useState(capable);

  useEffect(() => {
    const mq = window.matchMedia(CAPABLE);
    const onChange = () => setEnabled(mq.matches);
    mq.addEventListener("change", onChange);
    // The first render read the same query, but a resize landing between that
    // render and this effect would otherwise stick until the next change.
    onChange();
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return enabled;
}
