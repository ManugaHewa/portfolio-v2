import { forwardRef } from "react";
import { projectNumber } from "../../stats";
import type { ProjectSummary } from "../../types";

/**
 * A project as a playing card (deck.css). The corner index is the
 * project's number over its suit: an ember diamond for a case study, a sky
 * ring for the other work, the same two colours the page uses for doing and
 * for structure. The index repeats upside down in the opposite corner, the
 * way a card's does, and is decoration: the title says which project it is.
 */
export function Suit({ tier }: { tier: number }) {
  return <span className={tier === 1 ? "pcard-suit is-case" : "pcard-suit is-other"} aria-hidden="true" />;
}

function CornerIndex({ project, flipped = false }: { project: ProjectSummary; flipped?: boolean }) {
  return (
    <span className={flipped ? "pcard-index is-flipped" : "pcard-index"} aria-hidden="true">
      <span className="pcard-rank">{projectNumber(project.slug)}</span>
      <Suit tier={project.tier} />
    </span>
  );
}

interface CardFaceProps {
  project: ProjectSummary;
  /** Opens the case study; the button is handed over so focus can return to it. */
  onOpen?: (button: HTMLButtonElement) => void;
  /** A card under the face-up one: drawn, but no longer the one in play. */
  resting?: boolean;
}

/**
 * The face: the corner indices, the title, what the project is, its
 * category and status, and the way into its case study.
 */
export const CardFace = forwardRef<HTMLButtonElement, CardFaceProps>(function CardFace(
  { project: p, onOpen, resting = false },
  ref,
) {
  const meta = [p.category, p.status].filter(Boolean).join(" · ");
  return (
    <div className="pcard-face" data-tier={p.tier === 1 ? "case" : "other"}>
      <CornerIndex project={p} />
      <CornerIndex project={p} flipped />
      <div className="pcard-body">
        <h3 className="pcard-title">{p.title}</h3>
        <p className="pcard-line">{p.subtitle}</p>
        {meta && <p className="pcard-meta mono">{meta}</p>}
        {onOpen && !resting && (
          <button
            type="button"
            className="pcard-open"
            ref={ref}
            onClick={(e) => onOpen(e.currentTarget)}
          >
            {p.tier === 1 ? "Read the case study" : "Open the project"}
            <span className="visually-hidden"> for {p.title}</span>
          </button>
        )}
      </div>
    </div>
  );
});

/**
 * The back, engraved: a fine cross-hatch, the gyroscope's three rings at
 * their tilts in sky and ember around the monogram, and a frame inset from
 * the edge the way a printed card's is. One drawing for every card.
 */
export function CardBack() {
  return (
    <div className="pcard-back" aria-hidden="true">
      <svg className="pcard-back-art" viewBox="-50 -70 100 140" focusable="false">
        <rect className="pcard-back-frame" x="-43" y="-63" width="86" height="126" rx="5" />
        <rect className="pcard-back-frame is-inner" x="-39" y="-59" width="78" height="118" rx="3" />
        <g className="pcard-back-rings">
          <ellipse rx="30" ry="10" />
          <ellipse className="is-ember" rx="9" ry="30" />
          <ellipse rx="22" ry="7" transform="rotate(58)" />
          <circle r="11" className="pcard-back-core" />
        </g>
        <text className="pcard-back-mark" y="3.6" textAnchor="middle">
          MH
        </text>
      </svg>
    </div>
  );
}
