import { Fragment, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { useFinePointer, useMotionAllowed } from "./hooks";
import { cx } from "../lib/cx";

export interface HeroNameProps {
  id?: string;
  text: string;
  className?: string;
}

// Cursor reach, px.
const REACH = 220;
// Rest matches hero.css (wght 800, wdth 118%); the letter under the cursor peaks.
const REST = { wght: 800, wdth: 118 };
const PEAK = { wght: 900, wdth: 125 };

/** Cursor pull on a letter `distance` px away: 1 under it, smoothstep to 0 at REACH. */
export function pressure(distance: number): number {
  const t = Math.max(0, 1 - distance / REACH);
  return t * t * (3 - 2 * t);
}

/**
 * The page's h1. Words rise from a mask with CSS keyframes (motion.css), so
 * the name animates before JS loads; --i staggers the words.
 *
 * With a mouse and motion allowed, letters near the cursor get heavier and
 * wider on Mona Sans's axes, written once per frame. Width gained near the
 * cursor is taken back from the rest of the line, so it never rewraps.
 * Letters are split only after hydration; the HTML holds whole words. The
 * keyframes end on the element's own state, so nothing hides the name.
 */
export function HeroName({ id, text, className }: HeroNameProps) {
  const words = text.split(/\s+/).filter(Boolean);
  const ref = useRef<HTMLHeadingElement>(null);
  const allowed = useMotionAllowed();
  const fine = useFinePointer();
  const live = allowed && fine;

  useEffect(() => {
    const h1 = ref.current;
    const area = h1?.closest("section") ?? h1;
    if (!live || !h1 || !area) return;
    const letters = Array.from(h1.querySelectorAll<HTMLElement>(".hero-name-char"));
    let centres: { x: number; y: number }[] = [];
    // Line index per letter.
    let lineOf: number[] = [];
    let frame = 0;
    let pointer: { x: number; y: number } | null = null;

    // Letter centres in page coordinates, measured at rest so swelling never moves them.
    const measure = () => {
      for (const l of letters) l.style.fontVariationSettings = "";
      centres = letters.map((l) => {
        const r = l.getBoundingClientRect();
        return { x: r.left + r.width / 2 + window.scrollX, y: r.top + r.height / 2 + window.scrollY };
      });
      const rows: number[] = [];
      lineOf = centres.map((c) => {
        let k = rows.findIndex((y) => Math.abs(y - c.y) < 8);
        if (k < 0) k = rows.push(c.y) - 1;
        return k;
      });
    };

    const paint = () => {
      frame = 0;
      const p = letters.map((_, i) => {
        const c = centres[i];
        return pointer && c ? pressure(Math.hypot(pointer.x - c.x, pointer.y - c.y)) : 0;
      });
      // Each line's mean pull: the width its letters give back.
      const sum: number[] = [];
      const count: number[] = [];
      lineOf.forEach((k, i) => {
        sum[k] = (sum[k] ?? 0) + p[i];
        count[k] = (count[k] ?? 0) + 1;
      });
      letters.forEach((l, i) => {
        const k = lineOf[i];
        const mean = count[k] ? sum[k] / count[k] : 0;
        if (mean === 0) {
          l.style.fontVariationSettings = "";
          return;
        }
        const wght = REST.wght + (PEAK.wght - REST.wght) * p[i];
        // Giving back slightly more keeps the line from growing.
        const wdth = REST.wdth + (PEAK.wdth - REST.wdth) * (p[i] - mean * 1.08);
        l.style.fontVariationSettings = `"wght" ${wght.toFixed(0)}, "wdth" ${wdth.toFixed(1)}`;
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      pointer = { x: e.clientX + window.scrollX, y: e.clientY + window.scrollY };
      schedule();
    };
    // Re-measure on arrival: the entrance is over and the page may have scrolled.
    const onEnter = () => measure();
    const onLeave = () => {
      pointer = null;
      schedule();
    };
    const onResize = () => {
      measure();
      schedule();
    };

    measure();
    area.addEventListener("pointerenter", onEnter);
    area.addEventListener("pointermove", onMove);
    area.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", onResize);
    // Fonts change letter widths; re-measure once loaded.
    void document.fonts?.ready.then(onResize);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      area.removeEventListener("pointerenter", onEnter);
      area.removeEventListener("pointermove", onMove);
      area.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", onResize);
      for (const l of letters) l.style.fontVariationSettings = "";
    };
  }, [live]);

  return (
    <h1 id={id} ref={ref} className={cx("hero-name", live && "is-pressable", className)}>
      {words.map((word, i) => (
        <Fragment key={i}>
          {i > 0 && " "}
          <span className="hero-name-mask">
            <span className="hero-name-word" style={{ "--i": i } as CSSProperties}>
              {live
                ? Array.from(word).map((ch, k) => (
                    <span className="hero-name-char" key={k}>
                      {ch}
                    </span>
                  ))
                : word}
            </span>
          </span>
        </Fragment>
      ))}
    </h1>
  );
}
