import { useEffect, useRef, useState } from "react";
import { useMotionAllowed, useReplayInView } from "./hooks";
import { clamp } from "./internal";
import { cx } from "../lib/cx";

export type ScrambleTrigger = "mount" | "inView" | { active: boolean };

export interface ScrambleProps {
  text: string;
  className?: string;
  /** When the decode runs: on mount, on first view, or when `active` turns true. */
  trigger?: ScrambleTrigger;
}

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";

// Frames are written at most this often. Every animation frame would turn
// the glyphs into a blur rather than a readout settling.
const TICK_MS = 40;

const pick = (set: string) => set[Math.floor(Math.random() * set.length)];

/**
 * One frame of the decode: characters left of the resolved point are final;
 * the rest are random glyphs of the same kind (a digit for a digit, a capital
 * for a capital). Punctuation and spaces never change, so "43.52° N" reads as
 * an instrument settling on a value rather than as noise.
 */
export function scrambleFrame(chars: string[], progress: number): string {
  const settled = Math.floor(progress * chars.length);
  let out = "";
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (i < settled) out += c;
    else if (UPPER.includes(c)) out += pick(UPPER);
    else if (LOWER.includes(c)) out += pick(LOWER);
    else if (DIGITS.includes(c)) out += pick(DIGITS);
    else out += c;
  }
  return out;
}

/**
 * A mono label that decodes left to right: once on mount, or (trigger
 * "inView" or an `active` flag) each time it is reached, re-armed when the
 * visitor scrolls back above it. The final text is what the
 * server renders, what screen readers get and, outside the decode itself,
 * the only copy in the DOM.
 *
 * While decoding, the real text turns transparent (still in the
 * accessibility tree, still holding the width) and an aria-hidden overlay
 * shows the frames. Frames are written to the overlay's textContent from
 * requestAnimationFrame rather than through React state: twenty re-renders
 * a second for a label is waste. Math.random only ever runs in effects, so
 * the server and the first client render match.
 *
 * Never runs under reduced motion, before hydration or while motion is
 * paused; a paused decode stops and shows the final text.
 */
export function Scramble({ text, className, trigger = "mount" }: ScrambleProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const outRef = useRef<HTMLSpanElement>(null);
  const allowed = useMotionAllowed();
  const inView = useReplayInView(rootRef, 0.6);
  const [running, setRunning] = useState(false);
  const done = useRef(false);

  const fire = typeof trigger === "object" ? trigger.active : trigger === "inView" ? inView : true;
  // Anything but "mount" can fire again: back out of view, or the pipeline's
  // stage scrolled back, re-arms the decode.
  const rearm = trigger !== "mount";

  useEffect(() => {
    if (!allowed) {
      setRunning(false);
      return;
    }
    if (!fire) {
      if (rearm) done.current = false;
      return;
    }
    if (done.current) return;
    done.current = true;
    setRunning(true);
  }, [allowed, fire, rearm]);

  useEffect(() => {
    const out = outRef.current;
    if (!running || !out) return;
    const chars = Array.from(text);
    const duration = clamp(chars.length * 32, 420, 760);
    const start = performance.now();
    let last = start;
    let frame = 0;

    const step = (now: number) => {
      const progress = (now - start) / duration;
      if (progress >= 1) {
        setRunning(false);
        return;
      }
      if (now - last >= TICK_MS) {
        last = now;
        out.textContent = scrambleFrame(chars, progress);
      }
      frame = requestAnimationFrame(step);
    };

    out.textContent = scrambleFrame(chars, 0);
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [running, text]);

  return (
    <span ref={rootRef} className={cx("scramble", running && "is-scrambling", className)}>
      <span className="scramble-text">{text}</span>
      {running && <span ref={outRef} className="scramble-out" aria-hidden="true" />}
    </span>
  );
}
