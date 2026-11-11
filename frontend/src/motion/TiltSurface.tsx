import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { m, useMotionValue, useSpring, useTransform } from "./m";
import { useFinePointer, useMotionAllowed } from "./hooks";
import { TILT_SPRING } from "./internal";
import { cx } from "../lib/cx";

export interface TiltSurfaceProps {
  className?: string;
  /** Degrees, at the card's edge. */
  maxTilt?: number;
  /** The only layer that tilts: the figure. */
  visual: ReactNode;
  /** The text, links and button, which never move. */
  children?: ReactNode;
}

/** Lets a card level its tilt before it morphs into the dialog. */
export interface TiltSurfaceHandle {
  reset(): void;
}

/**
 * Where the visual layer's untransformed box starts inside the root. Read
 * from offsetLeft/offsetTop, which ignore transforms, so the answer is the
 * same whether or not the layer is tilted at that moment.
 */
function visualOffset(root: HTMLElement, visual: HTMLElement): { left: number; top: number } {
  if (visual.offsetParent === root) {
    return { left: visual.offsetLeft + root.clientLeft, top: visual.offsetTop + root.clientTop };
  }
  return { left: visual.offsetLeft - root.offsetLeft, top: visual.offsetTop - root.offsetTop };
}

/**
 * A card that tilts its visual layer toward the cursor and writes the cursor
 * position on its root for the spotlight and the glow border:
 * --mx / --my in px from the root's top-left corner, and --vx / --vy in px
 * from the visual layer's corner (for gradients painted on the figure).
 * The custom properties are set on the node directly, never through React
 * state, so moving the mouse re-renders nothing.
 *
 * Pointer events land on the root, which never moves, so a tilting edge
 * cannot slide out from under the cursor and make hover flicker. The content
 * beside the visual is never transformed, so text stays crisp and the button
 * and links stay exactly where they look. data-tilt="on" marks the root
 * while the effect is live, for CSS that should only show with it.
 *
 * Fine pointers only (touch and pens are ignored), and only while motion is
 * allowed: not before hydration, not under reduced motion, not while paused.
 * The tilt is decoration and never carries information. Keyboard focus never
 * tilts anything.
 */
export const TiltSurface = forwardRef<TiltSurfaceHandle, TiltSurfaceProps>(function TiltSurface(
  { className, maxTilt = 4, visual, children },
  ref,
) {
  const visualRef = useRef<HTMLDivElement>(null);
  const allowed = useMotionAllowed();
  const fine = useFinePointer();
  const enabled = allowed && fine;

  // -0.5 to 0.5 across the root, 0 at the centre.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, TILT_SPRING);
  const sy = useSpring(py, TILT_SPRING);
  // The side under the cursor dips away from the viewer.
  const rotateY = useTransform(sx, [-0.5, 0.5], [-maxTilt, maxTilt]);
  const rotateX = useTransform(sy, [-0.5, 0.5], [maxTilt, -maxTilt]);

  // Straight to level, no spring: before a press, before the morph into the
  // dialog, and whenever the effect switches off.
  const level = useCallback(() => {
    px.jump(0);
    py.jump(0);
    sx.jump(0);
    sy.jump(0);
  }, [px, py, sx, sy]);

  useImperativeHandle(ref, () => ({ reset: level }), [level]);

  useEffect(() => {
    if (!enabled) level();
  }, [enabled, level]);

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled || e.pointerType !== "mouse") return;
    const root = e.currentTarget;
    const r = root.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    root.style.setProperty("--mx", `${x}px`);
    root.style.setProperty("--my", `${y}px`);
    const v = visualRef.current;
    if (v) {
      const o = visualOffset(root, v);
      root.style.setProperty("--vx", `${x - o.left}px`);
      root.style.setProperty("--vy", `${y - o.top}px`);
    }
    px.set(x / r.width - 0.5);
    py.set(y / r.height - 0.5);
  };

  const onPointerLeave = () => {
    px.set(0);
    py.set(0);
  };

  return (
    <div
      className={cx("tilt-surface", className)}
      data-tilt={enabled ? "on" : undefined}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onPointerDown={level}
    >
      <m.div
        ref={visualRef}
        className="tilt-visual"
        // The perspective joins only while tilting is possible: at rest with
        // no rotation Motion writes no transform at all, so the prerendered
        // HTML carries none and the layer is not promoted for nothing.
        style={{ rotateX, rotateY, transformPerspective: enabled ? 900 : undefined }}
      >
        {visual}
      </m.div>
      {children}
    </div>
  );
});
