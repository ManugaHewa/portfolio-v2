import { useEffect, useLayoutEffect, useState } from "react";

/**
 * useLayoutEffect in the browser, useEffect while prerendering. React warns
 * about a layout effect on the server, where there is no layout to read, and
 * the build-time prerender renders every component there once.
 */
export const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * False on the server and on the browser's first render, true from the first
 * effect onward.
 *
 * The page is prerendered at build time with no idea of the visitor's
 * settings, and React's hydration expects the browser's first render to match
 * that HTML exactly. Anything that branches on a browser-only fact (the
 * reduced-motion preference, chiefly) has to wait for this, or React throws
 * the server HTML away and renders the whole page again.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
