import { Fragment, useMemo, useRef } from "react";
import { m } from "./m";
import type { Variants } from "./m";
import { useMotionAllowed, useReplayInView } from "./hooks";
import { EASE_OUT } from "./ease";

export type SplitTitleTag = "h1" | "h2" | "h3";

export interface SplitTitleProps {
  as?: SplitTitleTag;
  id?: string;
  className?: string;
  text: string;
}

// Delay between words, s.
const STAGGER = 0.07;

/**
 * A heading whose words slide up from masks each time it is scrolled to
 * (reset out of sight above). Spaces stay real text, so the accessible name
 * is the sentence and long titles still wrap.
 *
 * Words start hidden in the prerendered HTML, so each carries data-reveal
 * (undone by <noscript> and base.css's reduced-motion rule). Reduced motion
 * or "Pause motion" runs the slide with duration 0.
 */
export function SplitTitle({ as = "h2", id, className, text }: SplitTitleProps) {
  const words = text.split(/\s+/).filter(Boolean);
  const instant = !useMotionAllowed();
  const ref = useRef<HTMLHeadingElement>(null);
  const shown = useReplayInView(ref, 0.6);
  // m.h1/h2/h3 share one props shape; the cast names one.
  const Tag = m[as] as typeof m.h2;

  const word = useMemo<Variants>(
    () => ({
      hidden: { y: "120%", transition: { duration: 0 } },
      visible: (i: number) => ({
        y: "0%",
        transition: instant
          ? { duration: 0 }
          : { duration: 0.7, ease: EASE_OUT, delay: i * STAGGER },
      }),
    }),
    [instant],
  );

  return (
    <Tag
      ref={ref}
      id={id}
      className={className}
      initial="hidden"
      animate={shown ? "visible" : "hidden"}
    >
      {words.map((w, i) => (
        <Fragment key={i}>
          {i > 0 && " "}
          <span className="split-mask">
            <m.span className="split-word" data-reveal="" variants={word} custom={i}>
              {w}
            </m.span>
          </span>
        </Fragment>
      ))}
    </Tag>
  );
}
