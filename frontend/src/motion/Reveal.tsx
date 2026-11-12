import { useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { m } from "./m";
import { useReplayInView } from "./hooks";
import { EASE_OUT, useInstantMotion } from "./internal";

export type RevealTag = "div" | "li" | "article" | "section" | "ul" | "ol" | "span";

export interface RevealProps {
  as?: RevealTag;
  /** Place in a staggered group; the delay is index * stagger. */
  index?: number;
  /** Seconds between neighbours in a group. */
  stagger?: number;
  /** Pixels the element rises from. */
  y?: number;
  className?: string;
  id?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/**
 * An entrance each time it is scrolled down to: rise and fade, staggered
 * within a group, reset out of sight when the visitor scrolls back above it
 * (useReplayInView). Each
 * element watches its own visibility, so a group that arrives together
 * staggers by index and one that arrives row by row does not wait for the
 * rows above it.
 *
 * It starts hidden in the prerendered HTML, so it carries data-reveal, which
 * the <noscript> block and the reduced-motion rule in base.css both undo, as
 * does base.css's three-second fail-safe if the bundle never runs.
 * motion.css also shows it the moment anything inside takes focus, so a
 * keyboard user tabbing ahead of the scroll never lands on an invisible
 * link. Under reduced motion or "Pause motion" the entrance lands at once.
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
  // Every tag in RevealTag takes the same motion props; the cast only names one.
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
      // The reset happens below the fold, so it lands at once.
      transition={
        instant || !shown ? { duration: 0 } : { duration: 0.6, ease: EASE_OUT, delay: index * stagger }
      }
    >
      {children}
    </Tag>
  );
}
