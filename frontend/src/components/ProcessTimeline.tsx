import { useRef } from "react";
import { m } from "../motion/m";
import type { Variants } from "../motion/m";
import { EASE_OUT, useMotionAllowed, useReplayInView } from "../motion";

interface ProcessTimelineProps {
  /** Delivery steps, in order. */
  steps: string[];
  /** Results: the timeline's last stop. */
  outcomes: string[];
}

// Delay between steps, s.
const STEP = 0.14;

const ITEM: Variants = {
  hidden: { opacity: 0, x: -10, transition: { duration: 0 } },
  shown: (i: number) => ({ opacity: 1, x: 0, transition: { duration: 0.45, ease: EASE_OUT, delay: 0.1 + i * STEP } }),
};

const ITEM_INSTANT: Variants = {
  hidden: { opacity: 1, x: 0 },
  shown: { opacity: 1, x: 0 },
};

/**
 * A case study's delivery as a line: steps on a rail that draws itself down
 * the dialog, ending in an ember stop holding the outcomes (said only here).
 * One ordered list, the outcomes a list in its last item. Without motion
 * the line is just there; with it, it replays on each scroll down.
 */
export function ProcessTimeline({ steps, outcomes }: ProcessTimelineProps) {
  const ref = useRef<HTMLDivElement>(null);
  const allowed = useMotionAllowed();
  const inView = useReplayInView(ref, 0.15);
  const shown = !allowed || inView;
  const variants = allowed ? ITEM : ITEM_INSTANT;
  const total = steps.length + (outcomes.length > 0 ? 1 : 0);

  return (
    <section className="dialog-section dialog-process">
      <h3 className="dialog-section-title">{outcomes.length > 0 ? "How it was delivered, and what came of it" : "How it was delivered"}</h3>
      <m.div className="process" ref={ref} initial={false} animate={shown ? "shown" : "hidden"}>
        <m.span
          className="process-rail"
          aria-hidden="true"
          variants={{
            hidden: { scaleY: 0, transition: { duration: 0 } },
            shown: {
              scaleY: 1,
              transition: allowed ? { duration: 0.1 + total * STEP, ease: "linear" } : { duration: 0 },
            },
          }}
        />
        <ol className="process-list">
        {steps.map((step, i) => (
          <m.li className="process-step" key={step} custom={i} variants={variants}>
            {step}
          </m.li>
        ))}
        {outcomes.length > 0 && (
          <m.li className="process-step is-outcome" custom={steps.length} variants={variants}>
            <span className="process-outcome-label">Outcome</span>
            <ul className="process-outcomes">
              {outcomes.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </m.li>
        )}
        </ol>
      </m.div>
    </section>
  );
}
