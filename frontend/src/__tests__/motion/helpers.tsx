import type { ReactNode } from "react";
import { LazyMotion, domMax } from "../../motion/m";
import { MotionPauseProvider } from "../../motion";

export const REDUCED = "(prefers-reduced-motion: reduce)";
export const FINE = "(pointer: fine) and (hover: hover)";

/**
 * The app's own wrapper around the primitives: Motion's features loaded
 * once (strict, as in App.tsx) and the pause state.
 */
export function Wrap({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domMax} strict>
      <MotionPauseProvider>{children}</MotionPauseProvider>
    </LazyMotion>
  );
}

/**
 * A matchMedia whose answers a test controls, and which tells subscribers
 * when they change, the way the browser does when a setting flips. The
 * setup file's stub answers "no" to everything and never fires.
 */
export function installMatchMedia(matching: string[] = []) {
  const original = window.matchMedia;
  let current = new Set(matching);
  const listeners = new Set<() => void>();

  window.matchMedia = (query: string) =>
    ({
      get matches() {
        return current.has(query);
      },
      media: query,
      onchange: null,
      addEventListener: (_: string, l: () => void) => listeners.add(l),
      removeEventListener: (_: string, l: () => void) => listeners.delete(l),
      addListener: (l: () => void) => listeners.add(l),
      removeListener: (l: () => void) => listeners.delete(l),
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;

  return {
    set(next: string[]) {
      current = new Set(next);
      listeners.forEach((l) => l());
    },
    restore() {
      window.matchMedia = original;
    },
  };
}

/** querySelector that fails the test, with the selector, when nothing matches. */
export function find(root: ParentNode, selector: string): HTMLElement {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`Nothing matches ${selector}`);
  return el;
}
