import { useContext } from "react";
import { MotionPauseContext } from "../motion";
import { cx } from "../lib/cx";

/**
 * The gyroscope as a small mark, in SVG: the dark core, three rings at the
 * hero instrument's tilts in its colours, each turning at its own rate
 * (chrome.css), and an ember electron riding the outer one. It sits beside
 * the name in the header, and is what the hero's gyroscope shrinks into as
 * the page scrolls past it (Hero.tsx). Decoration only. Under reduced motion
 * or "Pause motion" it stands still.
 */
export function GyroMark({ className }: { className?: string }) {
  const { paused } = useContext(MotionPauseContext);
  return (
    <svg className={cx("gyro-mark", paused && "is-paused", className)} viewBox="-50 -50 100 100" aria-hidden="true" focusable="false">
      <circle className="gyro-mark-core" r="17" />
      <g className="gyro-mark-ring is-outer">
        <ellipse rx="44" ry="15" />
        <circle className="gyro-mark-electron" cx="44" cy="0" r="4.5" />
      </g>
      <g className="gyro-mark-ring is-middle">
        <ellipse rx="13" ry="37" />
      </g>
      <g className="gyro-mark-ring is-inner">
        <ellipse rx="30" ry="10" transform="rotate(60)" />
      </g>
    </svg>
  );
}
