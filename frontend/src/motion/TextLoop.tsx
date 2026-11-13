import { useEffect, useRef, useState } from "react";
import { m, useInView } from "./m";
import { useMotionAllowed, usePrefersReducedMotion } from "./hooks";
import { usePageVisible } from "./internal";
import { cx } from "../lib/cx";

export interface TextLoopProps {
  items: string[];
  /** Milliseconds each item stays. */
  interval?: number;
  /** The one sentence screen readers get in place of the rotating word. */
  srLabel: string;
  className?: string;
}

/** How long one turn of the reel takes, from letting go to the clunk (s). */
export const REEL_SPIN = 0.95;
/** How far past its word the reel runs before it drops back, in rows. */
const OVERSHOOT = 0.16;

/**
 * The rows a turn of the reel runs through, top to bottom, going from item
 * `from` to item `to` of `count`: once round the whole reel and on to the
 * new word, with one more row above it for the overshoot to show. The reel
 * runs downward, so each next word comes in from above, as on a slot
 * machine. The new word is row 1 and the old one the last row.
 */
export function reelRows(from: number, to: number, count: number): number[] {
  const steps = ((to - from + count) % count) + count;
  return Array.from({ length: steps + 2 }, (_, i) => (from + steps + 1 - i) % count);
}

/**
 * One word at the end of a line, changing like a slot machine's reel: the
 * words run down through the slot once round, a little smeared by their
 * speed, and the new one overshoots and clunks back into place.
 *
 * The visible word is aria-hidden: a screen reader would otherwise hear a
 * fragment change every few seconds. `srLabel` says the whole thing once
 * instead, in the HTML from the start.
 *
 * Every item also sits in the same grid cell as an invisible ghost (drawn
 * from a data attribute by motion.css, so the ghosts add no text to the
 * page), which makes the slot as wide as the longest item and keeps the line
 * from changing width as the words change. The reel itself is laid over the
 * slot only while it turns; at rest the slot holds the one word.
 *
 * The server and the first client render show items[0]. The timer starts
 * after hydration and only while the loop is on screen and the tab is in
 * front. "Pause motion" holds the current word (a turn under way simply
 * lands); reduced motion shows the first word and never turns.
 */
export function TextLoop({ items, interval = 2600, srLabel, className }: TextLoopProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const allowed = useMotionAllowed();
  const reduced = usePrefersReducedMotion();
  const inView = useInView(ref, { amount: 0.5 });
  const pageVisible = usePageVisible();
  // The word showing, and the one the reel is turning from (null at rest).
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

  // Paused mid-turn: the new word simply lands.
  useEffect(() => {
    if (!allowed && reel.from !== null) setReel((r) => ({ ...r, from: null }));
  }, [allowed, reel.from]);

  const shown = reduced ? 0 : reel.index % Math.max(count, 1);
  const turning = allowed && !reduced && reel.from !== null;
  const rows = turning ? reelRows(reel.from as number, shown, count) : [];
  // The reel's offset showing row `k`, as a share of its own height.
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
