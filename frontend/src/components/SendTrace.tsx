import { Fragment } from "react";
import { m } from "../motion/m";
import { useMotionAllowed } from "../motion";

/**
 * The four hops a message actually makes on submit. Deliberately the same
 * shape as the pipeline further up the page: that section shows how the
 * project list travels from one file to the screen, and this is the same kind
 * of route, running live, on the one form a visitor touches.
 *
 * Honest about what it shows. `stage` is driven by the real request, so the
 * trace parks at "POST /api/contact" for however long the network takes,
 * rather than playing a fixed animation that pretends to be progress.
 */
export const TRACE_STEPS = ["validate", "POST /api/contact", "zod.parse", "Postgres"] as const;

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface Props {
  /** Index of the step in flight. Steps before it are done. */
  stage: number;
}

export function SendTrace({ stage }: Props) {
  // Off under reduced motion, "Pause motion", and before hydration: the
  // connectors then land filled at once rather than drawing.
  const animate = useMotionAllowed();
  const current = Math.min(Math.max(stage, 0), TRACE_STEPS.length - 1);

  return (
    <div className="send-trace" role="status" aria-live="polite">
      <span className="visually-hidden">
        Sending: step {current + 1} of {TRACE_STEPS.length}, {TRACE_STEPS[current]}
      </span>

      <div className="send-trace-list" aria-hidden="true">
        {TRACE_STEPS.map((label, i) => (
          <Fragment key={label}>
            {i > 0 && (
              <span className="trace-link">
                <m.span
                  className="trace-link-fill"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: i <= stage ? 1 : 0 }}
                  transition={animate ? { duration: 0.45, ease: EASE_OUT } : { duration: 0 }}
                />
              </span>
            )}
            <span
              className={`trace-step${i < stage ? " is-done" : ""}${i === stage ? " is-active" : ""}`}
            >
              <span className="trace-dot" />
              {label}
            </span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
