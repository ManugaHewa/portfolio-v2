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
import type { ReactNode, RefObject } from "react";

/**
 * Whether the page pins (hero stage, pipeline). CSS uses the same query for
 * layout, so the prerendered HTML is right before scripts run; JS only adds
 * the scroll-driven transforms.
 */
export const PIN_QUERY =
  "(min-width: 1100px) and (min-height: 800px) and (prefers-reduced-motion: no-preference)";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
const FINE_POINTER_QUERY = "(pointer: fine) and (hover: hover)";

const noop = () => {};

/** useLayoutEffect in the browser, useEffect in the prerender (no layout there; React warns). */
export const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
const subscribeNever = () => noop;

/**
 * False on the server and while hydrating, true after. useSyncExternalStore
 * uses the server snapshot while hydrating (matching the HTML) and the
 * client one for later mounts, which skip a wasted "server" render.
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

/** A live media query match. False on the server and while hydrating. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useMemo(
    () => (onChange: () => void) => {
      if (!canMatchMedia()) return noop;
      const mql = window.matchMedia(query);
      // addListener: Safari before 14.
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
  const [active, setActive] = useState<string | null>(null);
  // String key, so callers can pass a fresh array each render.
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

/**
 * Whether an entrance shows its finished state: true once `amount` of the
 * element is in view, false again only after it drops below the viewport.
 * It replays on each scroll down but never hides in front of the visitor.
 * False on the server and until the first report, matching the prerender.
 */
export function useReplayInView(ref: RefObject<Element>, amount = 0.2): boolean {
  const [shown, setShown] = useState(false);

  useEffect(() => {
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
  }, [ref, amount]);

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
