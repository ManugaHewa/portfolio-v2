import { useEffect, useRef, useState } from "react";
import { useInView } from "./m";
import { useHydrated, useMotionAllowed, usePrefersReducedMotion } from "./hooks";
import { useIsomorphicLayoutEffect } from "./internal";
import { cx } from "../lib/cx";

export interface MarqueeProps {
  items: string[];
  /** The list's accessible name. */
  label: string;
}

// Pixels per second at full speed, and the share of it kept under the
// pointer or focus: slow enough to read a word, never a sudden stop.
const SPEED = 40;
const SLOW = 0.25;
// How long the speed change takes, in ms.
const EASE_RATE_MS = 320;

type Animated = Element & { getAnimations?: (options?: { subtree?: boolean }) => Animation[] };

/**
 * A strip that scrolls sideways, with its own pause toggle.
 *
 * The server and the first client render are ONE static list that wraps:
 * every item once, readable with no JavaScript, under reduced motion, and
 * by crawlers. After hydration, while motion is allowed and the strip's own
 * toggle is off, it becomes a moving row: a second, aria-hidden and inert
 * copy follows the first so the loop has no seam, and a CSS animation moves
 * both (motion.css). Paused, either way, it returns to the wrapped list.
 *
 * The lap time comes from the measured width of one copy, so the strip runs
 * at about 40px a second whatever it holds. Under the pointer or with focus
 * inside, it eases to a quarter of that speed through the Web Animations
 * playbackRate, which changes speed without a jump. Off screen it stops.
 */
export function Marquee({ items, label }: MarqueeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const copyRef = useRef<HTMLUListElement>(null);
  const hydrated = useHydrated();
  const reduced = usePrefersReducedMotion();
  const allowed = useMotionAllowed();
  const [ownPaused, setOwnPaused] = useState(false);
  const onScreen = useInView(rootRef, { margin: "200px 0px" });
  const running = allowed && !ownPaused;
  const rate = useRef({ value: 1, frame: 0 });

  // The lap time, from one copy's width plus the gap after it.
  useIsomorphicLayoutEffect(() => {
    const root = rootRef.current;
    const list = listRef.current;
    if (!running || !root || !list) return;
    const measure = () => {
      const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
      const width = list.getBoundingClientRect().width + gap;
      if (width > 0) root.style.setProperty("--marquee-duration", `${(width / SPEED).toFixed(2)}s`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    return () => ro.disconnect();
  }, [running]);

  // React 18 has no inert prop. The copy holds only text, but inert keeps it
  // out of find-in-page and selection as well as the accessibility tree.
  useEffect(() => {
    if (copyRef.current) copyRef.current.inert = true;
  }, [running]);

  useEffect(() => {
    const r = rate.current;
    return () => cancelAnimationFrame(r.frame);
  }, []);

  const easeRate = (to: number) => {
    const root = rootRef.current as Animated | null;
    if (!root?.getAnimations || !running) return;
    const r = rate.current;
    cancelAnimationFrame(r.frame);
    const from = r.value;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / EASE_RATE_MS);
      const eased = 1 - (1 - t) ** 3;
      r.value = from + (to - from) * eased;
      for (const a of root.getAnimations?.({ subtree: true }) ?? []) a.playbackRate = r.value;
      if (t < 1) r.frame = requestAnimationFrame(step);
    };
    r.frame = requestAnimationFrame(step);
  };

  // A restarted animation (paused, then running again) starts at full speed.
  useEffect(() => {
    if (!running) rate.current.value = 1;
  }, [running]);

  const list = (ref: typeof listRef, hidden: boolean) => (
    <ul
      ref={ref}
      className="marquee-list"
      aria-label={hidden ? undefined : label}
      aria-hidden={hidden ? "true" : undefined}
    >
      {items.map((item) => (
        <li className="marquee-item" key={item}>
          {item}
        </li>
      ))}
    </ul>
  );

  return (
    <div
      ref={rootRef}
      className={cx("marquee", running && "is-running", running && !onScreen && "is-offscreen")}
      onPointerEnter={(e) => e.pointerType === "mouse" && easeRate(SLOW)}
      onPointerLeave={(e) => e.pointerType === "mouse" && easeRate(1)}
      onFocus={() => easeRate(SLOW)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) easeRate(1);
      }}
    >
      <div className="marquee-viewport">
        {list(listRef, false)}
        {running && list(copyRef, true)}
      </div>
      {hydrated && !reduced && (
        <button
          type="button"
          className="marquee-toggle pause-toggle"
          aria-pressed={ownPaused}
          onClick={() => setOwnPaused((p) => !p)}
        >
          <span className="pause-toggle-glyph" aria-hidden="true" />
          Pause
        </button>
      )}
    </div>
  );
}
