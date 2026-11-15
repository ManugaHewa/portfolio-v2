import { useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { m } from "./m";
import { useReplayInView } from "./hooks";
import { EASE_OUT, useInstantMotion } from "./internal";

export type RevealTag = "div" | "li" | "article" | "section" | "ul" | "ol" | "span";

export interface RevealProps {
  as?: RevealTag;
  /** Index in a staggered group; delay = index * stagger. */
  index?: number;
  /** Seconds between neighbours. */
  stagger?: number;
  /** Rise distance, px. */
  y?: number;
  className?: string;
  id?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/**
 * Rise-and-fade entrance on each scroll down, reset out of sight above
 * (useReplayInView). Each element watches itself, so a group staggers by
 * index without waiting on earlier rows.
 *
 * Hidden in the prerendered HTML, so it carries data-reveal, undone by the
 * <noscript> block, base.css's reduced-motion rule and its 3 s fail-safe.
 * motion.css shows it when anything inside takes focus. Reduced motion or
 * "Pause motion" makes it land at once.
 */
export function Reveal({
  as = "div",
  index = 0,
  stagger = 0.08,
  y = 24,
  className,
  id,
  style,
  children,
}: RevealProps) {
  const instant = useInstantMotion();
  const ref = useRef<HTMLDivElement>(null);
  const shown = useReplayInView(ref, 0.2);
  // All RevealTag elements take the same motion props; the cast names one.
  const Tag = m[as] as typeof m.div;

  return (
    <Tag
      className={className}
      ref={ref}
      id={id}
      style={style}
      data-reveal=""
      initial={{ opacity: 0, y }}
      animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      // Resets happen below the fold, so they land at once.
      transition={
        instant || !shown ? { duration: 0 } : { duration: 0.6, ease: EASE_OUT, delay: index * stagger }
      }
    >
      {children}
    </Tag>
  );
}
