import { useEffect, useRef, useState } from "react";
import { m, useInView } from "./m";
import { useMotionAllowed, usePrefersReducedMotion } from "./hooks";
import { usePageVisible } from "./internal";
import { cx } from "../lib/cx";

export interface TextLoopProps {
  items: string[];
  /** Milliseconds per item. */
  interval?: number;
  /** The sentence screen readers get instead of the rotating word. */
  srLabel: string;
  className?: string;
}

/** Duration of one reel turn, s. */
export const REEL_SPIN = 0.95;
/** Overshoot past the word before dropping back, in rows. */
const OVERSHOOT = 0.16;

/**
 * Rows of a reel turn from item `from` to `to` of `count`, top to bottom:
 * once round plus the step to the new word, and one row above it for the
 * overshoot. The reel runs downward: the new word is row 1, the old one last.
 */
export function reelRows(from: number, to: number, count: number): number[] {
  const steps = ((to - from + count) % count) + count;
  return Array.from({ length: steps + 2 }, (_, i) => (from + steps + 1 - i) % count);
}

/**
 * A word that changes like a slot-machine reel: the words run down once
 * round, smeared by speed, and the new one overshoots and clunks into place.
 *
 * The word is aria-hidden; `srLabel` reads the whole line once. Invisible
 * ghosts of every item share the slot's grid cell (drawn from data-text in
 * motion.css, adding no page text), so the line never changes width. The
 * reel overlays the slot only while turning.
 *
 * Server and first render show items[0]. The timer runs after hydration,
 * only on screen with the tab in front. "Pause motion" holds the word (a
 * turn under way lands); reduced motion never turns.
 */
export function TextLoop({ items, interval = 2600, srLabel, className }: TextLoopProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const allowed = useMotionAllowed();
  const reduced = usePrefersReducedMotion();
  const inView = useInView(ref, { amount: 0.5 });
  const pageVisible = usePageVisible();
  // Current word, and the word the reel turns from (null at rest).
  const [reel, setReel] = useState<{ index: number; from: number | null }>({ index: 0, from: null });

  const count = items.length;
  const running = allowed && inView && pageVisible && count > 1;

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(
      () => setReel((r) => ({ index: (r.index + 1) % count, from: r.index })),
      interval,
    );
    return () => window.clearInterval(timer);
  }, [running, interval, count]);

  // Paused mid-turn: the new word lands.
  useEffect(() => {
    if (!allowed && reel.from !== null) setReel((r) => ({ ...r, from: null }));
  }, [allowed, reel.from]);

  const shown = reduced ? 0 : reel.index % Math.max(count, 1);
  const turning = allowed && reel.from !== null;
  const rows = turning ? reelRows(reel.from as number, shown, count) : [];
  // Reel offset showing row `k`, as a share of its height.
  const at = (k: number) => `${(-k / Math.max(rows.length, 1)) * 100}%`;

  return (
    <span ref={ref} className={cx("text-loop", className)}>
      <span className="text-loop-stage" aria-hidden="true" data-word={items[shown]}>
        {items.map((item) => (
          <span className="text-loop-ghost" data-text={item} key={item} />
        ))}
        {turning ? (
          <m.span
            key={`${reel.from}-${shown}`}
            className="text-loop-reel"
            initial={{ y: at(rows.length - 1), "--smear": 0 }}
            animate={{ y: [at(rows.length - 1), at(1 - OVERSHOOT), at(1)], "--smear": [0, 0.5, 0.5, 0] }}
            transition={{
              y: { duration: REEL_SPIN, times: [0, 0.8, 1], ease: [[0.5, 0, 0.2, 1], [0.3, 0, 0.3, 1]] },
              "--smear": { duration: REEL_SPIN, times: [0, 0.2, 0.5, 0.78], ease: "linear" },
            }}
            onAnimationComplete={() => setReel((r) => ({ ...r, from: null }))}
          >
            {rows.map((item, i) => (
              <span className="text-loop-word" data-text={items[item]} key={i}>
                {items[item]}
              </span>
            ))}
          </m.span>
        ) : (
          <span className="text-loop-word">{items[shown]}</span>
        )}
      </span>
      <span className="visually-hidden">{srLabel}</span>
    </span>
  );
}
