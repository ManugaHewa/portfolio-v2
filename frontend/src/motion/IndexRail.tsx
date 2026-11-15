import { memo, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { m, useMotionValue, useScroll, useTransform } from "./m";
import { PIN_QUERY, useActiveSection, useHydrated, useMediaQuery } from "./hooks";
import { clamp, smoothstep01 } from "../lib/math";

export interface RailSection {
  id: string;
  label: string;
}

export interface IndexRailProps {
  sections: RailSection[];
  /** Id of a stage that pins under PIN_QUERY (#top). The rail hides while it pins, fading in at the end. */
  hideWhilePinned?: string;
}

// base.css gives [id] scroll-margin-top: 80px; a tick sits where a jump to its section lands.
const SCROLL_MARGIN = 80;

// Share of the pin, at its end, over which the rail fades in.
const FADE_IN_SHARE = 0.25;

// Ball radius, its sideways drop into a pocket (px), and how long it sits
// in each pocket (share of the way to the next, each side).
const BALL_R = 4;
const SEAT_DEPTH = 4.5;
const SEAT = 0.2;

const smoother = (u: number) => u * u * u * (u * (u * 6 - 15) + 10);
const smoothstep = (a: number, b: number, v: number) => smoothstep01(clamp((v - a) / (b - a), 0, 1));

/**
 * The rail ball at scroll progress `p` (0-1), given ordered pocket
 * positions: `at` along the rail (0-1) and `seat` (0 on the track, 1 in a
 * pocket). It rests in each pocket for a stretch, then rolls to the next,
 * fastest midway. A pure function of scroll, not an animation.
 */
export function railBall(p: number, pockets: number[]): { at: number; seat: number } {
  const n = pockets.length;
  if (n === 0) return { at: p, seat: 0 };
  const first = pockets[0];
  const last = pockets[n - 1];
  // Outside the pockets it rolls with the page, dropping in and climbing out.
  if (p <= first) return { at: p, seat: smoothstep(first - 0.03, first, p) };
  if (p >= last) return { at: p, seat: 1 - smoothstep(last, last + 0.03, p) };
  let i = 0;
  while (i < n - 2 && p >= pockets[i + 1]) i++;
  const a = pockets[i];
  const b = pockets[i + 1];
  const t = b > a ? (p - a) / (b - a) : 0;
  const e = t <= SEAT ? 0 : t >= 1 - SEAT ? 1 : smoother((t - SEAT) / (1 - 2 * SEAT));
  return { at: a + (b - a) * e, seat: 1 - smoothstep(0, 0.12, Math.min(e, 1 - e)) };
}

const sameList = (a: number[] | null, b: number[]) =>
  a !== null && a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 0.001);

/**
 * Section index on the right edge of wide screens, drawn as a ball track:
 * one pocket per section, each a link whose label shows on hover and focus.
 * The current one has aria-current="location" (the nav's scroll-spy).
 *
 * --pos (0-1) places a pocket. The server spaces them evenly (the no-JS
 * layout); after hydration each moves to its section's place in the scroll
 * range, re-measured as the page resizes. The ball follows the scroll
 * directly (railBall), so it is the same under reduced motion.
 *
 * With hideWhilePinned, and only while pinning, the rail fades in as the
 * pinned stage lets go. Never on the server or while hydrating.
 */
export const IndexRail = memo(function IndexRail({ sections, hideWhilePinned }: IndexRailProps) {
  const active = useActiveSection(sections.map((s) => s.id));
  const hydrated = useHydrated();
  const pinned = useMediaQuery(PIN_QUERY);
  const trackRef = useRef<HTMLOListElement>(null);
  const [positions, setPositions] = useState<number[] | null>(null);
  const trackHeight = useMotionValue(0);
  const { scrollY, scrollYProgress } = useScroll();
  const last = Math.max(sections.length - 1, 1);
  const pockets = positions ?? sections.map((_, i) => i / last);
  // useTransform recomputes on every render, so moved pockets move the ball at once.
  const markerY = useTransform([scrollYProgress, trackHeight], ([p, h]) => railBall(p as number, pockets).at * (h as number));
  const markerX = useTransform(scrollYProgress, (p) => -SEAT_DEPTH * railBall(p, pockets).seat);
  // One turn per 2πr of travel.
  const markerTurn = useTransform(markerY, (y) => (y / BALL_R) * (180 / Math.PI));
  // Scroll positions where the pin ends and the fade-in starts.
  const pinEnd = useMotionValue(0);
  const fadeFrom = useMotionValue(0);
  const railOpacity = useTransform([scrollY, fadeFrom, pinEnd], ([y, from, end]) => {
    const [at, a, b] = [y as number, from as number, end as number];
    return b <= a ? 1 : clamp((at - a) / (b - a), 0, 1);
  });
  const key = sections.map((s) => s.id).join("|");

  useEffect(() => {
    const ids = key ? key.split("|") : [];
    let frame = 0;

    const measure = () => {
      frame = 0;
      const track = trackRef.current;
      if (track) trackHeight.set(track.clientHeight);
      const stage = hideWhilePinned ? document.getElementById(hideWhilePinned) : null;
      if (stage) {
        // A sticky stage pins until its container's bottom meets the viewport's.
        const rect = stage.getBoundingClientRect();
        const end = rect.bottom + window.scrollY - window.innerHeight;
        const start = Math.max(0, rect.top + window.scrollY);
        pinEnd.set(end);
        fadeFrom.set(end - (end - start) * FADE_IN_SHARE);
      }
      const range = document.documentElement.scrollHeight - window.innerHeight;
      if (range <= 0) return;
      const next = ids.map((id, i) => {
        const el = document.getElementById(id);
        if (!el) return i / Math.max(ids.length - 1, 1);
        const top = el.getBoundingClientRect().top + window.scrollY - SCROLL_MARGIN;
        return clamp(top / range, 0, 1);
      });
      setPositions((prev) => (sameList(prev, next) ? prev : next));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);
    window.addEventListener("resize", schedule);
    window.addEventListener("load", schedule);
    let live = true;
    document.fonts?.ready.then(() => live && schedule());

    return () => {
      live = false;
      if (frame) cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("load", schedule);
    };
  }, [key, trackHeight, hideWhilePinned, pinEnd, fadeFrom]);

  const fades = hydrated && pinned && hideWhilePinned !== undefined;

  return (
    <m.nav
      className="index-rail"
      aria-label="Section index"
      style={fades ? { opacity: railOpacity } : undefined}
    >
      <ol className="index-rail-track" ref={trackRef}>
        {sections.map((section, i) => (
          <li
            className="index-rail-item"
            key={section.id}
            style={{ "--pos": pockets[i] } as CSSProperties}
          >
            <a
              className="index-rail-tick"
              href={`#${section.id}`}
              aria-current={active === section.id ? "location" : undefined}
            >
              <span className="index-rail-label">{section.label}</span>
            </a>
          </li>
        ))}
      </ol>
      {hydrated && (
        <m.span className="index-rail-marker" aria-hidden="true" style={{ y: markerY, x: markerX, rotate: markerTurn }} />
      )}
    </m.nav>
  );
});
