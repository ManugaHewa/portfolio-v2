import { useEffect, useRef } from "react";
import { useInView, useMotionValueEvent, useReducedMotion, useSpring } from "framer-motion";

interface Props {
  value: number;
  /** Decimal places to hold, so 3.8 does not settle as 4. */
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

/**
 * Counts from zero to the value the first time it scrolls into view.
 *
 * The number is genuinely interpolated by a spring and written to the node,
 * rather than a set of hardcoded strings being swapped. That matters here
 * because the stats are real counts derived from the skills data: if a
 * technology is added, the target moves on its own.
 *
 * Under reduced motion the final value is simply rendered, no tween.
 */
export function CountUp({ value, decimals = 0, prefix = "", suffix = "", className }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  // Not `once`: the count replays every time the stats scroll back into
  // view, so the animation is something you can go back and watch rather
  // than a one-shot most visitors scroll straight past.
  const inView = useInView(ref, { amount: 0.4 });
  const reduceMotion = useReducedMotion();

  const format = (n: number) => `${prefix}${n.toFixed(decimals)}${suffix}`;

  const spring = useSpring(0, { stiffness: 55, damping: 18, restDelta: 0.001 });

  useEffect(() => {
    if (reduceMotion) return;
    if (inView) {
      spring.set(value);
    } else {
      // Snap back to zero while out of sight, so the next entrance starts
      // from the bottom instead of sitting on the finished number.
      spring.jump(0);
    }
  }, [inView, reduceMotion, spring, value]);

  useMotionValueEvent(spring, "change", (v) => {
    if (ref.current) ref.current.textContent = format(v);
  });

  // Rendered with the final value rather than a zero placeholder: if the
  // animation never runs (reduced motion, no JS, a failed effect) the correct
  // number is still what sits in the DOM.
  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
}
