import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useInView } from "./m";
import { useIsomorphicLayoutEffect, useMotionAllowed } from "./hooks";
import { cx } from "../lib/cx";
import { clamp, easeOutCubic, mod } from "../lib/math";

export interface MarqueeProps {
  items: string[];
  /** Accessible name of the list. */
  label: string;
}

// Drift speed (px/s), and the share of it kept under pointer or focus.
const SPEED = 40;
const SLOW = 0.25;
// Speed change duration, ms.
const EASE_RATE_MS = 320;
// Time for a fling to settle back into the drift, ms.
const FLING_SETTLE_MS = 1300;
// Fling speed cap, in multiples of the drift.
const FLING_MAX = 14;

type Animated = Element & { getAnimations?: (options?: { subtree?: boolean }) => Animation[] };

// One copy's width plus the gap after it: a lap.
const lapWidth = (list: HTMLElement) =>
  list.getBoundingClientRect().width + (parseFloat(getComputedStyle(list).columnGap) || 0);

/**
 * A sideways-scrolling strip with its own pause toggle.
 *
 * Server and first render: one static, wrapping list (readable without JS,
 * under reduced motion and by crawlers). After hydration, while motion is
 * allowed and not paused, an aria-hidden, inert copy follows the list and a
 * CSS animation moves both (motion.css).
 *
 * Lap time comes from one copy's width, so it drifts at about 40 px/s.
 * Under the pointer or focus it eases to a quarter speed via playbackRate;
 * off screen it stops. It can be grabbed, scrubbed and flung, then eases
 * back to the drift; vertical swipes still scroll the page.
 *
 * The toggle shows only while motion is allowed; otherwise the strip is
 * already still.
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
  // Grab: last pointer x and time, smoothed velocity (px/ms), lap length in px and ms.
  const grab = useRef<{ x: number; t: number; v: number; lapPx: number; lapMs: number } | null>(null);
  const [grabbing, setGrabbing] = useState(false);

  // Lap time from the lap width.
  useIsomorphicLayoutEffect(() => {
    const root = rootRef.current;
    const list = listRef.current;
    if (!running || !root || !list) return;
    const measure = () => {
      const width = lapWidth(list);
      if (width > 0) root.style.setProperty("--marquee-duration", `${(width / SPEED).toFixed(2)}s`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    return () => ro.disconnect();
  }, [running]);

  // React 18 has no inert prop. inert also keeps the copy out of find-in-page and selection.
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
    // Fetched once per ease, not per frame (each call forces a style update).
    const anims = root.getAnimations({ subtree: true });
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      r.value = from + (to - from) * easeOutCubic(t);
      for (const a of anims) a.playbackRate = r.value;
      if (t < 1) r.frame = requestAnimationFrame(step);
    };
    r.frame = requestAnimationFrame(step);
  };

  // A restarted animation starts at full speed.
  useEffect(() => {
    if (!running) rate.current.value = 1;
  }, [running]);

  // The drift to settle back to: slower under a mouse.
  const restingRate = () => (hovered.current ? SLOW : 1);

  const onGrab = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!running || e.button !== 0) return;
    const anims = animations();
    const list = listRef.current;
    const duration = Number(anims[0]?.effect?.getTiming().duration);
    if (anims.length === 0 || !list || !(duration > 0)) return;
    cancelAnimationFrame(rate.current.frame);
    for (const a of anims) a.pause();
    e.currentTarget.setPointerCapture(e.pointerId);
    grab.current = { x: e.clientX, t: performance.now(), v: 0, lapPx: lapWidth(list), lapMs: duration };
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
    // The strip moves left as its clock runs, so dragging right winds the
    // clock back. Offset far from zero so it never runs out.
    for (const a of animations()) {
      const time = Number(a.currentTime ?? 0) - dx * (g.lapMs / g.lapPx);
      a.currentTime = mod(time, g.lapMs) + g.lapMs * 1000;
    }
  };

  const onLetGo = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = grab.current;
    if (!g) return;
    grab.current = null;
    setGrabbing(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    // The drift runs left at SPEED px/s, so a throw to the right is a negative rate.
    const thrownAt = -(g.v * 1000) / SPEED;
    const r = clamp(thrownAt, -FLING_MAX, FLING_MAX);
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
