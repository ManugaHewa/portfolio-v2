import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";

/**
 * The one query that decides whether the page pins (the hero stage, the
 * pipeline). CSS reads the same string in @media rules and owns the layout;
 * JS reads it only to attach the scroll-driven transforms on top. That way
 * the prerendered HTML is laid out correctly for every visitor before any
 * script runs.
 */
export const PIN_QUERY =
  "(min-width: 1100px) and (min-height: 800px) and (prefers-reduced-motion: no-preference)";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
const FINE_POINTER_QUERY = "(pointer: fine) and (hover: hover)";

const noop = () => {};

/**
 * useLayoutEffect in the browser, useEffect while prerendering. React warns
 * about a layout effect on the server, where there is no layout to read, and
 * the build-time prerender renders every component there once. The one copy
 * for the whole site: the app shell, the contact form and the primitives.
 */
export const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
const subscribeNever = () => noop;

/**
 * False on the server and during hydration, true afterwards.
 *
 * Built on useSyncExternalStore rather than a state flag set in an effect:
 * React uses the server snapshot (false) while hydrating, so the browser's
 * first render matches the prerendered HTML, and the client snapshot (true)
 * for anything mounted later, so a dialog or a lazily loaded section does not
 * render once in its "server" form for nothing.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

function canMatchMedia(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

/**
 * Whether a media query matches, kept live. False on the server and during
 * hydration, for the same reason as useHydrated: the HTML was rendered
 * without knowing the visitor's screen or settings.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useMemo(
    () => (onChange: () => void) => {
      if (!canMatchMedia()) return noop;
      const mql = window.matchMedia(query);
      // addListener for Safari before 14, which has no addEventListener here.
      if (typeof mql.addEventListener === "function") {
        mql.addEventListener("change", onChange);
        return () => mql.removeEventListener("change", onChange);
      }
      mql.addListener(onChange);
      return () => mql.removeListener(onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => (canMatchMedia() ? window.matchMedia(query).matches : false),
    () => false,
  );
}

/**
 * The visitor's reduced-motion setting, through useMediaQuery. Components
 * use this rather than framer-motion's useReducedMotion, which reads the
 * setting during the first render and so disagrees with the prerendered
 * HTML.
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery(REDUCED_QUERY);
}

/** A mouse or trackpad: the only pointers cursor effects are for. */
export function useFinePointer(): boolean {
  return useMediaQuery(FINE_POINTER_QUERY);
}

/**
 * Scroll-spy for the header nav and the index rail: the id of the last
 * section whose top has crossed a line a third of the way down the viewport,
 * or null above the first one (in the hero, nothing is "current").
 *
 * getBoundingClientRect rather than offsetTop, because sticky stages and
 * transforms change what offsetTop is measured against. Reads are batched to
 * one per frame. At the very bottom of the page the last section may never
 * reach the line, so it is made current there.
 */
export function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  // A string key, so callers can pass a fresh array literal on every render
  // without restarting the listeners.
  const key = ids.join("|");

  useEffect(() => {
    const list = key ? key.split("|") : [];
    if (list.length === 0) return;
    let frame = 0;

    const measure = () => {
      frame = 0;
      const line = window.innerHeight * 0.34;
      let current: string | null = null;
      for (const id of list) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      const doc = document.documentElement;
      const atBottom = window.innerHeight + window.scrollY >= doc.scrollHeight - 2;
      if (atBottom && current !== null) current = list[list.length - 1];
      setActive(current);
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [key]);

  return active;
}

export interface MotionPause {
  paused: boolean;
  setPaused(p: boolean): void;
}

/**
 * The header's "Pause motion" toggle (WCAG 2.2.2). Held in React state for
 * the visit and never stored: the site keeps nothing in the browser. The
 * text loop, the marquee and every WebGL scene read it and stop.
 */
export const MotionPauseContext = createContext<MotionPause>({
  paused: false,
  setPaused: noop,
});

export function MotionPauseProvider(props: { children: ReactNode }): JSX.Element {
  const [paused, setPaused] = useState(false);
  const value = useMemo(() => ({ paused, setPaused }), [paused]);
  return createElement(MotionPauseContext.Provider, { value }, props.children);
}

/**
 * Whether anything may move right now: hydrated, no reduced-motion setting,
 * and not paused by the visitor. False on the server and during hydration,
 * so nothing starts moving until the page is the browser's own.
 */
export function useMotionAllowed(): boolean {
  const hydrated = useHydrated();
  const reduced = usePrefersReducedMotion();
  const { paused } = useContext(MotionPauseContext);
  return hydrated && !reduced && !paused;
}
