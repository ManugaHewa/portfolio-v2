import { Fragment, useMemo, useRef } from "react";
import { m } from "./m";
import type { Variants } from "./m";
import { useReplayInView } from "./hooks";
import { EASE_OUT, useInstantMotion } from "./internal";

export type SplitTitleTag = "h1" | "h2" | "h3";

export interface SplitTitleProps {
  as?: SplitTitleTag;
  id?: string;
  className?: string;
  text: string;
}

// Seconds between one word starting and the next.
const STAGGER = 0.07;

/**
 * A heading split into words, each in a mask, so the words slide up into
 * place each time the heading is scrolled down to (reset out of sight when
 * the visitor scrolls back above it). The spaces stay real text nodes between
 * the masks, so the heading's text and accessible name are the sentence and
 * a long title still wraps between words.
 *
 * The words start below their masks in the prerendered HTML (Motion writes
 * the hidden variant as inline styles), so each carries data-reveal: the
 * <noscript> block and the reduced-motion rule in base.css show them in
 * place. Under reduced motion or "Pause motion" the slide still happens, with
 * duration 0, so the words are never left hidden.
 */
export function SplitTitle({ as = "h2", id, className, text }: SplitTitleProps) {
  const words = text.split(/\s+/).filter(Boolean);
  const instant = useInstantMotion();
  const ref = useRef<HTMLHeadingElement>(null);
  const shown = useReplayInView(ref, 0.6);
  // m.h1 / m.h2 / m.h3 share one props shape; the cast only names one of them.
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
