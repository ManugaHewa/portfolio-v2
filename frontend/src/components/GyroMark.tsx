import { useContext } from "react";
import { MotionPauseContext } from "../motion";
import { cx } from "../lib/cx";

/**
 * The gyroscope as a small mark, in SVG, drawn as the hero's instrument is
 * (Scene3D.tsx, "core"): the steel outer gimbal on its stand, the sky inner
 * gimbal across it, and the ember flywheel at the centre, whose spokes turn
 * (chrome.css). It sits beside the name in the header, and is what the
 * hero's gyroscope shrinks into as the page scrolls past it (Hero.tsx).
 * Decoration only. Under reduced motion or "Pause motion" it stands still.
 */
export function GyroMark({ className }: { className?: string }) {
  const { paused } = useContext(MotionPauseContext);
  return (
    <svg className={cx("gyro-mark", paused && "is-paused", className)} viewBox="-50 -50 100 100" aria-hidden="true" focusable="false">
      <g className="gyro-mark-stand">
        <path d="M0 -40 V-47 M0 40 V47" />
        <ellipse cx="0" cy="48" rx="11" ry="3" />
      </g>
      <ellipse className="gyro-mark-outer" rx="30" ry="40" />
      <ellipse className="gyro-mark-inner" rx="33" ry="21" transform="rotate(32)" />
      <g transform="rotate(-24) scale(1 0.46)">
        <g className="gyro-mark-rotor">
          <circle r="20" />
          <path d="M-20 0 H20 M-10 -17.3 L10 17.3 M-10 17.3 L10 -17.3" />
        </g>
      </g>
      <circle className="gyro-mark-hub" r="3" />
    </svg>
  );
}
