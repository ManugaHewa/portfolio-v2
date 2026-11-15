import { useEffect, useRef, useState } from "react";
import { useMotionAllowed, useReplayInView } from "./hooks";
import { clamp } from "../lib/math";
import { cx } from "../lib/cx";

export type ScrambleTrigger = "mount" | "inView" | { active: boolean };

export interface ScrambleProps {
  text: string;
  className?: string;
  /** Runs on mount, on first view, or when `active` turns true. */
  trigger?: ScrambleTrigger;
}

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";

// Frame write interval; every animation frame would blur the glyphs.
const TICK_MS = 40;

const pick = (set: string) => set[Math.floor(Math.random() * set.length)];

/**
 * One decode frame: characters before the resolved point are final, the
 * rest random glyphs of the same kind. Punctuation and spaces stay, so
 * "43.52° N" reads as an instrument settling.
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
 * "inView" or `active`) each time it is reached, re-armed above. The final
 * text is what the server renders and screen readers get.
 *
 * While decoding, the real text goes transparent (keeping its width and
 * name) and an aria-hidden overlay shows frames written straight from
 * requestAnimationFrame, not React state. Math.random runs only in effects,
 * so hydration matches. Never runs under reduced motion, before hydration
 * or while paused.
 */
export function Scramble({ text, className, trigger = "mount" }: ScrambleProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const outRef = useRef<HTMLSpanElement>(null);
  const allowed = useMotionAllowed();
  // Only "inView" needs an observer.
  const inView = useReplayInView(rootRef, 0.6, trigger === "inView");
  const [running, setRunning] = useState(false);
  const done = useRef(false);

  const fire = typeof trigger === "object" ? trigger.active : trigger === "inView" ? inView : true;
  // Triggers other than "mount" re-arm when they turn false.
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
