import { useContext } from "react";
import { MotionPauseContext } from "../motion";
import { cx } from "../lib/cx";
import { POCKETS, WHEEL, pocketInk, wedgePath } from "../lib/roulette";

const R_IN = 25.5;
const R_OUT = 37;

// One wedge per pocket, in wheel order, zero at the top.
const SECTORS = WHEEL.map((n, i) => {
  const a0 = -Math.PI / 2 + ((i - 0.5) * 2 * Math.PI) / POCKETS;
  const a1 = a0 + (2 * Math.PI) / POCKETS;
  return {
    key: n,
    ink: pocketInk(n),
    d: wedgePath(R_IN, R_OUT, a0, a1),
  };
});

/**
 * The wheel as a small SVG mark: bowl, pockets in the hero wheel's colours,
 * cone, turret and the ball in the zero. The head turns slowly (chrome.css)
 * and stops under reduced motion or "Pause motion". It sits by the name in
 * the header, where the hero wheel docks (Hero.tsx). Decorative.
 */
export function WheelMark({ className }: { className?: string }) {
  const { paused } = useContext(MotionPauseContext);
  return (
    <svg className={cx("wheel-mark", paused && "is-paused", className)} viewBox="-50 -50 100 100" aria-hidden="true" focusable="false">
      <circle className="wheel-mark-bowl" r="48" />
      <circle className="wheel-mark-track" r="41" />
      <g className="wheel-mark-head">
        {SECTORS.map((s) => (
          <path key={s.key} className={`wheel-mark-pocket is-${s.ink}`} d={s.d} />
        ))}
        <circle className="wheel-mark-cone" r={R_IN} />
        <circle className="wheel-mark-inlay" r="15" />
        <path className="wheel-mark-turret" d="M-12 0H12M0 -12V12" />
        <circle className="wheel-mark-knob" r="4" />
        <circle className="wheel-mark-ball" cy={-(R_IN + R_OUT) / 2} r="3.6" />
      </g>
    </svg>
  );
}
