import { useEffect, useRef, useState } from "react";
import { AnimatePresence, m, useInView } from "./m";
import { useMotionAllowed, usePrefersReducedMotion } from "./hooks";
import { EASE_OUT, usePageVisible } from "./internal";
import { cx } from "../lib/cx";

export interface TextLoopProps {
  items: string[];
  /** Milliseconds each item stays. */
  interval?: number;
  /** The one sentence screen readers get in place of the rotating word. */
  srLabel: string;
  className?: string;
}

/**
 * One word at the end of a line, swapping through `items`: the outgoing word
 * slides up out of a mask as the next rises into it.
 *
 * The visible word is aria-hidden: a screen reader would otherwise hear a
 * fragment change every few seconds. `srLabel` says the whole thing once
 * instead, in the HTML from the start.
 *
 * Every item also sits in the same grid cell as an invisible ghost (drawn
 * from a data attribute by motion.css, so the ghosts add no text to the
 * page), which makes the slot as wide as the longest item and keeps the line
 * from changing width as the words change.
 *
 * The server and the first client render show items[0]. The timer starts
 * after hydration and only while the loop is on screen and the tab is in
 * front. "Pause motion" holds the current word; reduced motion shows the
 * first word and never rotates.
 */
export function TextLoop({ items, interval = 2600, srLabel, className }: TextLoopProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const allowed = useMotionAllowed();
  const reduced = usePrefersReducedMotion();
  const inView = useInView(ref, { amount: 0.5 });
  const pageVisible = usePageVisible();
  const [index, setIndex] = useState(0);

  const count = items.length;
  const running = allowed && inView && pageVisible && count > 1;

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % count), interval);
    return () => window.clearInterval(timer);
  }, [running, interval, count]);

  const shown = reduced ? 0 : index % Math.max(count, 1);

  return (
    <span ref={ref} className={cx("text-loop", className)}>
      <span className="text-loop-stage" aria-hidden="true">
        {items.map((item) => (
          <span className="text-loop-ghost" data-text={item} key={item} />
        ))}
        <AnimatePresence initial={false}>
          <m.span
            key={shown}
            className="text-loop-word"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: "0%", opacity: 1 }}
            exit={{ y: "-100%", opacity: 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.42, ease: EASE_OUT }}
          >
            {items[shown]}
          </m.span>
        </AnimatePresence>
      </span>
      <span className="visually-hidden">{srLabel}</span>
    </span>
  );
}
