import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode, RefObject } from "react";

/**
 * Whether the page pins (hero stage, pipeline). CSS uses the same query for
 * layout, so the prerendered HTML is right before scripts run; JS only adds
 * the scroll-driven transforms.
 */
export const PIN_QUERY =
  "(min-width: 1100px) and (min-height: 800px) and (prefers-reduced-motion: no-preference)";

export const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
export const FINE_POINTER_QUERY = "(pointer: fine) and (hover: hover)";

/** Sticky header height (tokens.css --header-h); pinned stages stick just under it. */
export const HEADER_H = 64;

const noop = () => {};
const yes = () => true;
const no = () => false;

/** useLayoutEffect in the browser, useEffect in the prerender (no layout there; React warns). */
export const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
const subscribeNever = () => noop;

/**
 * False on the server and while hydrating, true after. useSyncExternalStore
 * uses the server snapshot while hydrating (matching the HTML) and the
 * client one for later mounts, which skip a wasted "server" render.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNever, yes, no);
}

function canMatchMedia(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

/** A live media query match. False on the server and while hydrating. */
export function useMediaQuery(query: string): boolean {
  // Stable functions per query, so React does not re-check the snapshot on every render.
  const store = useMemo(
    () => ({
      subscribe: (onChange: () => void) => {
        if (!canMatchMedia()) return noop;
        const mql = window.matchMedia(query);
        mql.addEventListener("change", onChange);
        return () => mql.removeEventListener("change", onChange);
      },
      read: () => (canMatchMedia() ? window.matchMedia(query).matches : false),
    }),
    [query],
  );
  return useSyncExternalStore(store.subscribe, store.read, no);
}

/** Reduced-motion setting. Not framer-motion's useReducedMotion, which mismatches the prerender. */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery(REDUCED_QUERY);
}

/** Mouse or trackpad: the only pointers cursor effects are for. */
export function useFinePointer(): boolean {
  return useMediaQuery(FINE_POINTER_QUERY);
}

/**
 * Scroll-spy for the nav and index rail: the last section whose top has
 * crossed 34% of the viewport, or null above the first. Reads rects (sticky
 * stages and transforms skew offsetTop), once per frame. At the page
 * bottom, the last section is current.
 */
export function useActiveSection(ids: string[]): string | null {
  // String key, so callers can pass a fresh array each render.
  const key = ids.join("|");
  const subscribe = useCallback((onChange: () => void) => (key ? watchSections(key, onChange) : noop), [key]);
  const read = useCallback(() => spies.get(key)?.value ?? null, [key]);
  return useSyncExternalStore(subscribe, read, nothing);
}

const nothing = () => null;

// One scroll listener and one measurement per frame for every caller with the same ids (the nav and the rail).
interface Spy {
  value: string | null;
  listeners: Set<() => void>;
  stop: () => void;
}
const spies = new Map<string, Spy>();

function watchSections(key: string, onChange: () => void): () => void {
  let spy = spies.get(key);
  if (!spy) {
    const list = key.split("|");
    let frame = 0;
    const s: Spy = { value: null, listeners: new Set(), stop: noop };
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
      if (current === s.value) return;
      s.value = current;
      for (const l of s.listeners) l();
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    s.stop = () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
    spies.set(key, s);
    spy = s;
    measure();
  }
  const s = spy;
  s.listeners.add(onChange);
  return () => {
    s.listeners.delete(onChange);
    if (s.listeners.size === 0) {
      s.stop();
      spies.delete(key);
    }
  };
}

/**
 * Whether an entrance shows its finished state: true once `amount` of the
 * element is in view, false again only after it drops below the viewport.
 * It replays on each scroll down but never hides in front of the visitor.
 * False on the server and until the first report, matching the prerender.
 */
export function useReplayInView(ref: RefObject<Element>, amount = 0.2, enabled = true): boolean {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // Off: no observer at all (callers that only sometimes need it).
    if (!enabled) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver !== "function") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // Too tall to ever show `amount`: counts once it fills that share of the viewport.
          const viewH = entry.rootBounds?.height ?? window.innerHeight;
          const tall = (entry.boundingClientRect?.height ?? 0) * amount > viewH;
          if (entry.isIntersecting && (entry.intersectionRatio >= amount * 0.99 || tall)) {
            setShown(true);
          } else if (!entry.isIntersecting) {
            // Below the viewport (scrolled back up): re-arm. Above it: leave it.
            const top = entry.boundingClientRect?.top ?? 0;
            const bottom = entry.rootBounds?.bottom ?? window.innerHeight;
            if (top >= bottom) setShown(false);
          }
        }
      },
      { threshold: [0, amount, 0.5, 1].filter((t, i, a) => a.indexOf(t) === i) },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, amount, enabled]);

  return shown;
}

export interface MotionPause {
  paused: boolean;
  setPaused(p: boolean): void;
}

/** The header's "Pause motion" toggle (WCAG 2.2.2). React state for the visit, never stored. */
export const MotionPauseContext = createContext<MotionPause>({
  paused: false,
  setPaused: noop,
});

export function MotionPauseProvider(props: { children: ReactNode }): JSX.Element {
  const [paused, setPaused] = useState(false);
  const value = useMemo(() => ({ paused, setPaused }), [paused]);
  return createElement(MotionPauseContext.Provider, { value }, props.children);
}

/** Whether anything may move: hydrated, no reduced motion, not paused. */
export function useMotionAllowed(): boolean {
  const hydrated = useHydrated();
  const reduced = usePrefersReducedMotion();
  const { paused } = useContext(MotionPauseContext);
  return hydrated && !reduced && !paused;
}
