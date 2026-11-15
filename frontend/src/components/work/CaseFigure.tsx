import { m } from "../../motion/m";
import { projectNumber } from "../../stats";
import type { Screenshot } from "../../screenshots";
import type { ProjectSummary } from "../../types";

interface FigureContentsProps {
  project: ProjectSummary;
  shot: Screenshot | undefined;
  /** Keep the pieces at their own size while the figure scales in the morph. */
  holdShape: boolean;
}

/**
 * A case study's figure at the head of its dialog (the face-up card grows
 * into it): a screenshot, or else a plate with the project's number
 * (decorative generated content) and its subtitle.
 */
export function FigureContents({ project: p, shot, holdShape }: FigureContentsProps) {
  const hold = holdShape ? "position" : undefined;

  if (shot) {
    return (
      <div className="case-figure-inner has-shot">
        <img
          src={shot.src}
          alt={shot.alt}
          width={1600}
          height={1000}
          decoding="async"
        />
      </div>
    );
  }

  return (
    <div className="case-figure-inner">
      <m.span className="case-figure-num" data-number={projectNumber(p.slug)} aria-hidden="true" layout={hold} />
      <m.p className="case-figure-line" layout={hold}>
        {p.subtitle}
      </m.p>
    </div>
  );
}
