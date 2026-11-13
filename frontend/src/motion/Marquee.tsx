import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useInView } from "./m";
import { useMotionAllowed } from "./hooks";
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
// How long a fling takes to come back to the drift, in ms.
const FLING_SETTLE_MS = 1300;
// The fastest a fling may run, in multiples of the drift.
const FLING_MAX = 14;

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
 *
 * It can be grabbed: pressing on the moving strip holds it, dragging scrubs
 * it along under the pointer (the animation's own clock, moved by the
 * distance dragged), and letting go throws it at the speed it was let go
 * at, either way, easing back into the drift over a second or so. A
 * vertical swipe on a touch screen still scrolls the page.
 *
 * The strip's own toggle is there only while motion is allowed. Under the
 * header's "Pause motion" or reduced motion the strip is already still, and a
 * toggle saying "not paused" that changes nothing would mislead.
 */
export function Marquee({ items, label }: MarqueeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const copyRef = useRef<HTMLUListElement>(null);
  const allowed = useMotionAllowed();
  const [ownPaused, setOwnPaused] = useState(false);
  const onScreen = useInView(rootRef, { margin: "200px 0px" });
  const running = allowed && !ownPaused;
  const rate = useRef({ value: 1, frame: 0 });
  const hovered = useRef(false);
  // The grab in progress: the last pointer x and time, the smoothed
  // velocity (px/ms), and one lap's length in px and in ms.
  const grab = useRef<{ x: number; t: number; v: number; lapPx: number; lapMs: number } | null>(null);
  const [grabbing, setGrabbing] = useState(false);

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

  const animations = () => (rootRef.current as Animated | null)?.getAnimations?.({ subtree: true }) ?? [];

  const easeRate = (to: number, ms = EASE_RATE_MS) => {
    const root = rootRef.current as Animated | null;
    if (!root?.getAnimations || !running) return;
    const r = rate.current;
    cancelAnimationFrame(r.frame);
    const from = r.value;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
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

  // The drift the strip settles back to: slower under a mouse.
  const restingRate = () => (hovered.current ? SLOW : 1);

  const onGrab = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!running || e.button !== 0) return;
    const anims = animations();
    const list = listRef.current;
    const duration = Number(anims[0]?.effect?.getTiming().duration);
    if (anims.length === 0 || !list || !(duration > 0)) return;
    const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
    cancelAnimationFrame(rate.current.frame);
    for (const a of anims) a.pause();
    e.currentTarget.setPointerCapture(e.pointerId);
    grab.current = { x: e.clientX, t: performance.now(), v: 0, lapPx: list.getBoundingClientRect().width + gap, lapMs: duration };
    setGrabbing(true);
  };

  const onDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = grab.current;
    if (!g) return;
    const now = performance.now();
    const dx = e.clientX - g.x;
    const dt = Math.max(1, now - g.t);
    g.v = g.v * 0.6 + (dx / dt) * 0.4;
    g.x = e.clientX;
    g.t = now;
    // The strip runs left as its clock runs forward, so dragging right
    // winds the clock back. Kept far from zero so it never runs out.
    for (const a of animations()) {
      const time = Number(a.currentTime ?? 0) - dx * (g.lapMs / g.lapPx);
      a.currentTime = (((time % g.lapMs) + g.lapMs) % g.lapMs) + g.lapMs * 1000;
    }
  };

  const onLetGo = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = grab.current;
    if (!g) return;
    grab.current = null;
    setGrabbing(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    // Moving with the hand when it let go: the drift's speed is SPEED px/s
    // to the left, so a throw to the right is a negative rate.
    const thrownAt = -(g.v * 1000) / SPEED;
    const r = Math.max(-FLING_MAX, Math.min(FLING_MAX, thrownAt));
    rate.current.value = r;
    for (const a of animations()) {
      a.playbackRate = r;
      a.play();
    }
    easeRate(restingRate(), FLING_SETTLE_MS);
  };

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
      className={cx(
        "marquee",
        running && "is-running",
        running && !onScreen && !grabbing && "is-offscreen",
        grabbing && "is-grabbing",
      )}
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return;
        hovered.current = true;
        if (!grab.current) easeRate(SLOW);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "mouse") return;
        hovered.current = false;
        if (!grab.current) easeRate(1);
      }}
      onFocus={() => easeRate(SLOW)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) easeRate(1);
      }}
    >
      <div
        className="marquee-viewport"
        onPointerDown={onGrab}
        onPointerMove={onDrag}
        onPointerUp={onLetGo}
        onPointerCancel={onLetGo}
      >
        {list(listRef, false)}
        {running && list(copyRef, true)}
      </div>
      {allowed && (
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
