import { useContext } from "react";
import { MotionPauseContext } from "../motion";
import { cx } from "../lib/cx";
import { POCKETS, WHEEL, pocketInk } from "../lib/roulette";

const R_IN = 25.5;
const R_OUT = 37;
const f = (n: number) => Number(n.toFixed(2));
const at = (r: number, a: number) => `${f(r * Math.cos(a))} ${f(r * Math.sin(a))}`;

// One wedge a pocket, in wheel order, the zero at the top.
const SECTORS = WHEEL.map((n, i) => {
  const a0 = -Math.PI / 2 + ((i - 0.5) * 2 * Math.PI) / POCKETS;
  const a1 = a0 + (2 * Math.PI) / POCKETS;
  return {
    key: n,
    ink: pocketInk(n),
    d: `M${at(R_IN, a0)}L${at(R_OUT, a0)}A${R_OUT} ${R_OUT} 0 0 1 ${at(R_OUT, a1)}L${at(R_IN, a1)}A${R_IN} ${R_IN} 0 0 0 ${at(R_IN, a0)}Z`,
  };
});

/**
 * The roulette wheel as a small mark, in SVG, drawn face on: the bowl, the
 * pockets in wheel order in the hero wheel's colours (rouletteScene.ts), the
 * cone with its inlay, the turret, and the ball at rest in the zero. The
 * head turns slowly (chrome.css). It sits beside the name in the header and
 * is what the hero's wheel shrinks into as the page scrolls past it
 * (Hero.tsx). Decoration only. Under reduced motion or "Pause motion" it
 * stands still.
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
