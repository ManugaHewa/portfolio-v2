import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { m, useMotionValue, useScroll, useTransform } from "./m";
import { PIN_QUERY, useActiveSection, useHydrated, useMediaQuery } from "./hooks";

export interface RailSection {
  id: string;
  label: string;
}

export interface IndexRailProps {
  sections: RailSection[];
  /**
   * The id of a stage that pins under PIN_QUERY (the hero, #top). While it
   * is pinned the rail is faded out, and it fades in over the last part of
   * the pin, so it never crowds what the pinned stage is showing.
   */
  hideWhilePinned?: string;
}

// Where an in-page jump leaves a section's top (base.css gives every [id]
// scroll-margin-top: 80px). A tick sits at the scroll position a jump to
// its section lands on, so the marker crosses the tick exactly there.
const SCROLL_MARGIN = 80;

// The share of the pin, at its end, over which the rail fades in.
const FADE_IN_SHARE = 0.25;

const sameList = (a: number[] | null, b: number[]) =>
  a !== null && a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 0.001);

/**
 * The section index down the right edge on wide screens, drawn like a gimbal
 * scale: one hairline, one calibration tick per section. Each tick is a link
 * whose mono label shows on hover and focus and is its accessible name; the
 * current section's tick has aria-current="location" (from the same
 * scroll-spy as the header nav).
 *
 * --pos (0 to 1) places a tick along the rail. The server renders them evenly
 * spaced, which is also the no-JavaScript layout. After hydration each tick
 * moves to its section's measured place in the page's scroll range,
 * re-measured whenever the page's size changes (fonts arriving, the project
 * list loading, a resize), and an 8px ember ring rides the hairline with the
 * scroll position. The ring follows the scroll directly, with no spring, so
 * it is a readout of the visitor's own scrolling rather than an animation,
 * and is the same under reduced motion.
 *
 * With hideWhilePinned, and only while the page pins (PIN_QUERY), the whole
 * rail is faded out at the top of the page and fades in as the pinned stage
 * lets go, measured from the stage's place in the page like the ticks are.
 * Never on the server or during hydration, so the HTML shows the rail.
 */
export function IndexRail({ sections, hideWhilePinned }: IndexRailProps) {
  const active = useActiveSection(sections.map((s) => s.id));
  const hydrated = useHydrated();
  const pinned = useMediaQuery(PIN_QUERY);
  const trackRef = useRef<HTMLOListElement>(null);
  const [positions, setPositions] = useState<number[] | null>(null);
  const trackHeight = useMotionValue(0);
  const { scrollY, scrollYProgress } = useScroll();
  const markerY = useTransform([scrollYProgress, trackHeight], ([p, h]) => (p as number) * (h as number));
  // The scroll positions where the pin ends and where the fade-in starts.
  const pinEnd = useMotionValue(0);
  const fadeFrom = useMotionValue(0);
  const railOpacity = useTransform([scrollY, fadeFrom, pinEnd], ([y, from, end]) => {
    const [at, a, b] = [y as number, from as number, end as number];
    if (b <= a) return 1;
    return Math.min(1, Math.max(0, (at - a) / (b - a)));
  });
  const last = Math.max(sections.length - 1, 1);
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
        // A sticky stage is pinned from the page's top until its container's
        // end meets the window's: that is the scroll range of the hand-off.
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
        return Math.min(1, Math.max(0, top / range));
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
            style={{ "--pos": positions?.[i] ?? i / last } as CSSProperties}
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
      {hydrated && <m.span className="index-rail-marker" aria-hidden="true" style={{ y: markerY }} />}
    </m.nav>
  );
}
