import { useContext } from "react";
import { MotionPauseContext, useHydrated } from "./hooks";
import { cx } from "../lib/cx";

/**
 * "Pause motion" (WCAG 2.2.2): stops the text loop, marquee and WebGL
 * scenes for the visit; aria-pressed carries the state. Hidden but holding
 * its space until hydrated, so it never shifts the header.
 */
export function PauseMotionToggle({ className }: { className?: string }) {
  const { paused, setPaused } = useContext(MotionPauseContext);
  const hydrated = useHydrated();

  return (
    <button
      type="button"
      className={cx("pause-toggle", className)}
      aria-pressed={paused}
      onClick={() => setPaused(!paused)}
      style={hydrated ? undefined : { visibility: "hidden" }}
    >
      <span className="pause-toggle-glyph" aria-hidden="true" />
      Pause motion
    </button>
  );
}
