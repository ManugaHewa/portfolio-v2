import { useEffect, useRef, useState } from "react";
import { animate, m, useMotionValue, useTransform } from "./m";
import type { MotionValue } from "./m";
import { useHydrated, useIsomorphicLayoutEffect, useMotionAllowed, useReplayInView } from "./hooks";
import { clamp, mod } from "../lib/math";
import { cx } from "../lib/cx";

export interface OdometerProps {
  value: number;
  className?: string;
}

// Reel cell height, em; matches the slot's line-height in motion.css.
const CELL_EM = 1;

// Slightly underdamped: a small overshoot, settling in about a second.
const ROLL = { type: "spring" as const, stiffness: 60, damping: 13, restDelta: 0.001 };

/**
 * Reel position (0-10; 10 is the repeated 0) for one place value at
 * `count`. The units reel turns continuously; higher reels turn only while
 * the reel below passes 9 to 0, like a mechanical odometer.
 */
export function reelPosition(count: number, place: number): number {
  if (place === 1) return mod(count, 10);
  const whole = Math.floor(count / place);
  const within = count - whole * place;
  const carry = clamp(within - (place - 1), 0, 1);
  return mod(whole + carry, 10);
}

const digitAt = (value: number, place: number) => Math.floor(value / place) % 10;

/**
 * A number that rolls into place one digit at a time.
 *
 * The server renders the final digits as text (aria-hidden, with a visually
 * hidden copy for screen readers). After hydration, with motion allowed and
 * the number below the fold, the digits become reels at 0 that roll up when
 * seen. A number already on screen keeps its digits (a roll would show wrong
 * values). Back below the fold, the reels reset out of sight to roll again.
 * Reel faces are CSS (motion.css).
 */
export function Odometer({ value, className }: OdometerProps) {
  const target = Math.max(0, Math.round(value));
  const ref = useRef<HTMLSpanElement>(null);
  const hydrated = useHydrated();
  const allowed = useMotionAllowed();
  const count = useMotionValue(target);
  const inView = useReplayInView(ref, 0.6);
  const wasInView = useRef(false);
  const decided = useRef(false);
  // false: plain digits; true: reels waiting at 0.
  const [reels, setReels] = useState(false);

  useIsomorphicLayoutEffect(() => {
    if (!hydrated || decided.current) return;
    decided.current = true;
    const el = ref.current;
    if (!allowed || !el || target === 0) return;
    // Measured before paint, so a number in view only ever shows itself.
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom >= 0) return;
    count.jump(0);
    setReels(true);
  }, [hydrated, allowed, target, count]);

  // Re-armed below the fold: back to 0 out of sight.
  useEffect(() => {
    if (inView) {
      wasInView.current = true;
      return;
    }
    if (!wasInView.current || !allowed || target === 0) return;
    wasInView.current = false;
    count.jump(0);
    setReels(true);
  }, [inView, allowed, target, count]);

  const armed = reels && inView;

  useEffect(() => {
    if (!armed) return;
    // Paused or reduced mid-roll: jump to the value.
    if (!allowed) {
      count.jump(target);
      return;
    }
    const controls = animate(count, target, { ...ROLL, delay: 0.1 });
    return () => controls.stop();
  }, [armed, allowed, target, count]);

  const places = String(target).length;

  return (
    <span ref={ref} className={cx("odometer", className)}>
      <span className="odometer-digits" aria-hidden="true">
        {!reels
          ? String(target)
          : Array.from({ length: places }, (_, k) => {
              const place = 10 ** (places - 1 - k);
              return <Reel key={place} place={place} count={count} digit={digitAt(target, place)} />;
            })}
      </span>
      <span className="visually-hidden">{target}</span>
    </span>
  );
}

interface ReelProps {
  place: number;
  count: MotionValue<number>;
  digit: number;
}

/**
 * One place value, keyed by place, so a growing number adds reels on the
 * left. The ghost digit gives the slot its width and baseline, and keeps
 * the text the number.
 */
function Reel({ place, count, digit }: ReelProps) {
  const y = useTransform(count, (c) => `${-reelPosition(c, place) * CELL_EM}em`);
  return (
    <span className="odometer-slot">
      <span className="odometer-ghost">{digit}</span>
      <m.span className="odometer-reel" style={{ y }} />
    </span>
  );
}
