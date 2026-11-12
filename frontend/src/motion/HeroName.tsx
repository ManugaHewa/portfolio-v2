import { Fragment, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { useFinePointer, useMotionAllowed } from "./hooks";
import { cx } from "../lib/cx";

export interface HeroNameProps {
  id?: string;
  text: string;
  className?: string;
}

// How far from the cursor a letter still answers it, in px.
const REACH = 220;
// The resting axes are the ones hero.css sets (weight 800, width 118%); a
// letter right under the cursor goes to the face's heaviest and widest.
const REST = { wght: 800, wdth: 118 };
const PEAK = { wght: 900, wdth: 125 };

/**
 * How strongly a letter answers a cursor `distance` px away: 1 under the
 * cursor, easing to 0 at REACH (smoothstep, so the falloff has no edge).
 */
export function pressure(distance: number): number {
  const t = Math.max(0, 1 - distance / REACH);
  return t * t * (3 - 2 * t);
}

/**
 * The page's h1. Each word rises from a mask with CSS keyframes alone
 * (motion.css), so the name animates before any JavaScript has loaded and
 * the largest paint is not held back by it. --i is each word's place in the
 * 70ms stagger.
 *
 * With a mouse, and while motion is allowed, the letters answer the cursor:
 * each one near the pointer goes heavier and wider on Mona Sans's own weight
 * and width axes, falling off smoothly over about 220px, so the name swells
 * where the cursor passes. Only the letterforms change (no colour, glow or
 * shadow). The axes are written straight to the letters once per frame.
 * The width a line gains near the cursor is taken back from its letters
 * further away, which narrow a little, so each line keeps its length and
 * the name never rewraps. The prerendered HTML has whole words; the
 * letters are split only after hydration, and their text is the same name.
 *
 * Nothing here hides the name in the HTML: the keyframes only run under
 * prefers-reduced-motion: no-preference, and their end state is the
 * element's own, so without CSS animation the name simply sits in place.
 * No data-reveal for the same reason.
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
    // Which line each letter sits on, by index into `lineOf`.
    let lineOf: number[] = [];
    let frame = 0;
    let pointer: { x: number; y: number } | null = null;

    // Letter centres in page coordinates, measured at rest so the swelling
    // itself never moves the targets. Re-measured on resize.
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
      // Each line's average pressure: what its letters give back in width.
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
        // A little extra given back keeps the line from ever growing.
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
    // Measured afresh as the pointer arrives: by then the name's entrance
    // has long finished, and the page may have scrolled.
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
    // The fonts settle the letters' widths; measure again once they have.
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
