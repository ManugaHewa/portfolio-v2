import { Fragment } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * The four hops a message actually makes on submit. Deliberately the same
 * shape as the schema-to-pixel pipeline further up the page: that section
 * claims the stack is typed and validated end to end, and this is that same
 * claim running live on the one form a visitor touches.
 *
 * Honest about what it shows. `stage` is driven by the real request, so the
 * trace parks at "POST /api/contact" for however long the network takes,
 * rather than playing a fixed animation that pretends to be progress.
 */
export const TRACE_STEPS = ["validate", "POST /api/contact", "zod.parse", "Postgres"] as const;

interface Props {
  /** Index of the step in flight. Steps before it are done. */
  stage: number;
}

export function SendTrace({ stage }: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="send-trace" role="status" aria-live="polite">
      <span className="visually-hidden">
        Sending: step {Math.min(stage + 1, TRACE_STEPS.length)} of {TRACE_STEPS.length},{" "}
        {TRACE_STEPS[Math.min(stage, TRACE_STEPS.length - 1)]}
      </span>

      {TRACE_STEPS.map((label, i) => (
        <Fragment key={label}>
          {i > 0 && (
            <span className="trace-link" aria-hidden="true">
              <motion.span
                className="trace-link-fill"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: i <= stage ? 1 : 0 }}
                transition={
                  reduceMotion ? { duration: 0 } : { duration: 0.45, ease: [0.16, 1, 0.3, 1] }
                }
              />
            </span>
          )}
          <span
            className={`trace-step${i < stage ? " is-done" : ""}${i === stage ? " is-active" : ""}`}
            aria-hidden="true"
          >
            <span className="trace-dot" />
            {label}
          </span>
        </Fragment>
      ))}
    </div>
  );
}
