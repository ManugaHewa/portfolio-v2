import { useRef } from "react";
import { m } from "../motion/m";
import type { Variants } from "../motion/m";
import { useMotionAllowed, useReplayInView } from "../motion";

interface ProcessTimelineProps {
  /** How the project was delivered, step by step. */
  steps: string[];
  /** What came of it: the timeline's last stop. */
  outcomes: string[];
}

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
// Seconds between one step arriving and the next.
const STEP = 0.14;

const ITEM: Variants = {
  hidden: { opacity: 0, x: -10, transition: { duration: 0 } },
  shown: (i: number) => ({ opacity: 1, x: 0, transition: { duration: 0.45, ease: EASE, delay: 0.1 + i * STEP } }),
};

const ITEM_INSTANT: Variants = {
  hidden: { opacity: 1, x: 0 },
  shown: { opacity: 1, x: 0 },
};

/**
 * A case study's delivery, told as a line: each step a stop on a rail that
 * draws itself down the dialog as the visitor reaches it, and the rail ends
 * in an ember stop holding the outcomes, so the process visibly leads to
 * what came of it. The outcomes are said here and nowhere else in the
 * dialog.
 *
 * Real list markup throughout (one ordered list, the outcomes a list inside
 * its last item), so a screen reader hears the steps in order and the
 * outcomes as their end. Without motion (reduced, paused, not yet hydrated)
 * the whole line is simply there; with it, the line replays each time it is
 * scrolled down to inside the dialog (useReplayInView).
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
