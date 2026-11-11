import { useEffect } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { m, useMotionValue, useSpring } from "./m";
import { useFinePointer, useMotionAllowed } from "./hooks";
import { clamp } from "./internal";
import { cx } from "../lib/cx";

export interface MagneticProps {
  /** Share of the cursor's offset the child follows. */
  strength?: number;
  /** Pixels, at most. */
  maxOffset?: number;
  className?: string;
  children: ReactNode;
}

// Quick and slightly lively, but settled well inside a quarter second.
const PULL = { stiffness: 320, damping: 22, mass: 0.5 };

/**
 * Draws its child a few pixels toward the cursor (the primary button, on fine
 * pointers, while motion is allowed).
 *
 * The outer span is the hit area and never moves; it reaches 12px past the
 * child on every side (motion.css) so the pull starts just before the cursor
 * arrives. Only the inner span is transformed, and by at most maxOffset, so
 * the target stays under a cursor aimed at its edge. The child is a real link
 * or button and works the same without any of this. Keyboard focus gets the
 * normal focus ring and no movement.
 */
export function Magnetic({ strength = 0.25, maxOffset = 6, className, children }: MagneticProps) {
  const allowed = useMotionAllowed();
  const fine = useFinePointer();
  const enabled = allowed && fine;

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, PULL);
  const sy = useSpring(y, PULL);

  useEffect(() => {
    if (enabled) return;
    x.jump(0);
    y.jump(0);
    sx.jump(0);
    sy.jump(0);
  }, [enabled, x, y, sx, sy]);

  const onPointerMove = (e: ReactPointerEvent<HTMLSpanElement>) => {
    if (!enabled || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    x.set(clamp((e.clientX - (r.left + r.width / 2)) * strength, -maxOffset, maxOffset));
    y.set(clamp((e.clientY - (r.top + r.height / 2)) * strength, -maxOffset, maxOffset));
  };

  const onPointerLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <span className={cx("magnetic", className)} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
      <m.span className="magnetic-inner" style={{ x: sx, y: sy }}>
        {children}
      </m.span>
    </span>
  );
}
