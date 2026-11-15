import { Fragment } from "react";
import { m } from "../motion/m";
import { useMotionAllowed } from "../motion";

/**
 * The four hops a message makes on submit, shaped like the pipeline above.
 * `stage` follows the real request, so the trace waits at "POST
 * /api/contact" as long as the network takes.
 */
export const TRACE_STEPS = ["validate", "POST /api/contact", "zod.parse", "Postgres"] as const;

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface Props {
  /** Index of the step in flight; earlier steps are done. */
  stage: number;
}

export function SendTrace({ stage }: Props) {
  // Off under reduced motion, "Pause motion" and before hydration: connectors fill at once.
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
