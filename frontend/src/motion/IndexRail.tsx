import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { m, useMotionValue, useScroll, useTransform } from "./m";
import { useActiveSection, useHydrated } from "./hooks";

export interface RailSection {
  id: string;
  label: string;
}

export interface IndexRailProps {
  sections: RailSection[];
}

// Where an in-page jump leaves a section's top (base.css gives every [id]
// scroll-margin-top: 80px). A tick sits at the scroll position a jump to
// its section lands on, so the marker crosses the tick exactly there.
const SCROLL_MARGIN = 80;

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
 */
export function IndexRail({ sections }: IndexRailProps) {
  const active = useActiveSection(sections.map((s) => s.id));
  const hydrated = useHydrated();
  const trackRef = useRef<HTMLOListElement>(null);
  const [positions, setPositions] = useState<number[] | null>(null);
  const trackHeight = useMotionValue(0);
  const { scrollYProgress } = useScroll();
  const markerY = useTransform([scrollYProgress, trackHeight], ([p, h]) => (p as number) * (h as number));
  const last = Math.max(sections.length - 1, 1);
  const key = sections.map((s) => s.id).join("|");

  useEffect(() => {
    const ids = key ? key.split("|") : [];
    let frame = 0;

    const measure = () => {
      frame = 0;
      const track = trackRef.current;
      if (track) trackHeight.set(track.clientHeight);
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
  }, [key, trackHeight]);

  return (
    <nav className="index-rail" aria-label="Section index">
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
    </nav>
  );
}
