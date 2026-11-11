import { useEffect, useRef, useState } from "react";
import { animate, m, useInView, useMotionValue, useTransform } from "./m";
import type { MotionValue } from "./m";
import { useHydrated, useMotionAllowed } from "./hooks";
import { useIsomorphicLayoutEffect } from "./internal";
import { cx } from "../lib/cx";

export interface OdometerProps {
  value: number;
  className?: string;
}

// Height of one cell on a reel, in em. motion.css uses the same number for
// the slot's line-height, so a reel moved by n cells shows digit n exactly.
const CELL_EM = 1;

// The counter's spring (SPEC.md section 4: numbers roll on Motion springs).
// Just under critically damped: the reels settle with a slight overshoot, the
// way a mechanical counter clicks into place, in a little over a second.
const ROLL = { type: "spring" as const, stiffness: 60, damping: 13, restDelta: 0.001 };

const mod10 = (n: number) => ((n % 10) + 10) % 10;

/**
 * Where the reel for one place value stands when the counter reads `count`,
 * as a position from 0 to 10 (10 is the repeated 0 at the reel's foot). The
 * units reel turns continuously; every higher reel stays on its digit and
 * turns only while the reel below it passes from 9 to 0, the way a
 * mechanical odometer carries. At whole numbers every reel rests exactly on
 * a digit.
 */
export function reelPosition(count: number, place: number): number {
  if (place === 1) return mod10(count);
  const whole = Math.floor(count / place);
  const within = count - whole * place;
  const carry = Math.min(1, Math.max(0, within - (place - 1)));
  return mod10(whole + carry);
}

const digitAt = (value: number, place: number) => Math.floor(value / place) % 10;

/**
 * A number that rolls into place one place value at a time.
 *
 * The server renders the final digits as plain text, so crawlers, link
 * previews and visitors without JavaScript read the real number. The digits
 * are aria-hidden and a visually hidden copy carries the number for screen
 * readers, so the reels are never read out.
 *
 * After hydration, if motion is allowed, the digits become reels:
 * - already on screen at that moment: the reels jump to value - 10 (which
 *   leaves the units digit where it was) and spin one full turn to the
 *   value, so nothing visible drops to zero;
 * - below the fold: the reels wait at 0 and roll up the first time the
 *   number comes into view.
 * Under reduced motion or "Pause motion" the final digits simply stay. The
 * reel faces are drawn by CSS (motion.css), so the page text stays the
 * number itself.
 */
export function Odometer({ value, className }: OdometerProps) {
  const target = Math.max(0, Math.round(value));
  const ref = useRef<HTMLSpanElement>(null);
  const hydrated = useHydrated();
  const allowed = useMotionAllowed();
  const count = useMotionValue(target);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const decided = useRef(false);
  // null: plain digits. Otherwise the reels are shown, and `spin` says
  // whether they start at once (on screen at hydration) or wait for the view.
  const [reels, setReels] = useState<{ spin: boolean } | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (!hydrated || decided.current) return;
    decided.current = true;
    const el = ref.current;
    if (!allowed || !el || target === 0) return;
    const r = el.getBoundingClientRect();
    const onScreen = r.top < window.innerHeight && r.bottom >= 0;
    count.jump(onScreen ? Math.max(0, target - 10) : 0);
    setReels({ spin: onScreen });
  }, [hydrated, allowed, target, count]);

  const spin = reels?.spin ?? false;
  const armed = reels !== null && (spin || inView);

  useEffect(() => {
    if (!armed) return;
    // Paused or reduced part way through: land on the value now.
    if (!allowed) {
      count.jump(target);
      return;
    }
    const controls = animate(count, target, { ...ROLL, delay: spin ? 0.25 : 0.1 });
    return () => controls.stop();
  }, [armed, spin, allowed, target, count]);

  const places = String(target).length;

  return (
    <span ref={ref} className={cx("odometer", className)}>
      <span className="odometer-digits" aria-hidden="true">
        {reels === null
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
 * One place value. Keyed by place from the right, so when a number grows a
 * new reel arrives on the left and the units reel keeps turning. The ghost
 * digit is the reel's final face in normal flow: it gives the slot its width
 * and a real text baseline, and keeps the element's text the number.
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
