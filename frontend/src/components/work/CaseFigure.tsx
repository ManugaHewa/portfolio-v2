import { m } from "../../motion/m";
import { projectNumber } from "../../stats";
import type { Screenshot } from "../../screenshots";
import type { ProjectSummary } from "../../types";

interface FigureContentsProps {
  project: ProjectSummary;
  shot: Screenshot | undefined;
  /** In the dialog the image is wanted at once; in a card it can wait for the scroll. */
  eager?: boolean;
  /**
   * Hold each piece at its own size while the figure around it is scaled
   * during the morph, so the number and the line move with the figure
   * instead of stretching with it.
   */
  holdShape: boolean;
}

/**
 * What a case study's figure shows (redesign SPEC.md, section 5.3), the same
 * in its card and at the head of its dialog, so the morph between the two
 * carries one picture rather than two.
 *
 * A screenshot when there is one. Otherwise a plate drawn from the project's
 * own data: its number, large, as decoration (generated content on an empty
 * element, so it is not text and is not read twice), and its subtitle, which
 * says what the thing is. The outcome and the stack are left to the text
 * beside it, so the card says each of them once.
 */
export function FigureContents({ project: p, shot, eager = false, holdShape }: FigureContentsProps) {
  const hold = holdShape ? "position" : undefined;

  if (shot) {
    return (
      <div className="case-figure-inner has-shot">
        <img
          src={shot.src}
          alt={shot.alt}
          width={1600}
          height={1000}
          loading={eager ? undefined : "lazy"}
          decoding="async"
        />
      </div>
    );
  }

  return (
    <div className="case-figure-inner">
      <m.span className="case-figure-num" data-number={projectNumber(p.slug)} aria-hidden="true" layout={hold} />
      <span className="case-scale" aria-hidden="true" />
      <m.p className="case-figure-line" layout={hold}>
        {p.subtitle}
      </m.p>
    </div>
  );
}
