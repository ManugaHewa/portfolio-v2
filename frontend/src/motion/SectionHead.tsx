import type { ReactNode } from "react";
import { SplitTitle } from "./SplitTitle";
import { cx } from "../lib/cx";

export interface SectionHeadProps {
  /** The h2's id, for the section's aria-labelledby. */
  titleId: string;
  title: string;
  intro?: ReactNode;
  className?: string;
  /** Anything that belongs beside the heading, such as a readout. */
  children?: ReactNode;
}

/** Every section's heading: an h2 that slides in by word, and one intro line. */
export function SectionHead({ titleId, title, intro, className, children }: SectionHeadProps) {
  return (
    <div className={cx("section-head", className)}>
      <SplitTitle as="h2" id={titleId} className="section-title" text={title} />
      {intro && <p className="section-intro">{intro}</p>}
      {children}
    </div>
  );
}
