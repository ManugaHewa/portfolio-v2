import { memo } from "react";
import { m } from "../../motion/m";
import { POCKETS, svgNum as f, wedgePath } from "../../lib/roulette";
import { projectNumber } from "../../stats";
import type { ProjectSummary } from "../../types";
import { MORPH_SPRING } from "../work/workUtils";

/**
 * A project as a playing card (deck.css). The corner index is the project's
 * number over its suit (ember diamond: case study; sky ring: other work),
 * repeated upside down opposite. Decorative; the title names the project.
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
  /** Opens the case study; gets the button so focus can return to it. */
  onOpen?: (button: HTMLButtonElement) => void;
  /** Under the face-up card: drawn, no longer in play. */
  resting?: boolean;
  /** Shared layoutId with the dialog's figure (ProjectModal.tsx), for the morph. */
  layoutId?: string;
}

/** The face corner shown under a lifted corner (the squeeze, DeckTable.tsx); deck.css turns it. */
export function PeelCorner({ project }: { project: ProjectSummary }) {
  return (
    <span className="pcard-peel-face" data-tier={project.tier === 1 ? "case" : "other"}>
      <CornerIndex project={project} />
    </span>
  );
}

/** The face: indices, title, subtitle, category and status, and the case study button. Memoised: pile faces never change. */
export const CardFace = memo(function CardFace({ project: p, onOpen, resting = false, layoutId }: CardFaceProps) {
  const meta = [p.category, p.status].filter(Boolean).join(" · ");
  return (
    <m.div
      className="pcard-face"
      data-tier={p.tier === 1 ? "case" : "other"}
      layoutId={layoutId}
      transition={{ layout: MORPH_SPRING }}
    >
      <CornerIndex project={p} />
      <CornerIndex project={p} flipped />
      <div className="pcard-body">
        <h3 className="pcard-title">{p.title}</h3>
        <p className="pcard-line">{p.subtitle}</p>
        {meta && <p className="pcard-meta mono">{meta}</p>}
        {onOpen && !resting && (
          <button type="button" className="pcard-open" onClick={(e) => onOpen(e.currentTarget)}>
            {p.tier === 1 ? "Read the case study" : "Open the project"}
            <span className="visually-hidden"> for {p.title}</span>
          </button>
        )}
      </div>
    </m.div>
  );
});

/** The joker, left once every card is drawn: J over both suits. DRAFT copy for approval. */
export const JOKER = {
  title: "That's the deck",
  line: "All thirteen, face up. If one of them is close to what you need, tell me about it.",
  link: "Get in touch",
};

export function JokerFace() {
  return (
    <div className="pcard-face is-joker" data-tier="joker">
      {[false, true].map((flipped) => (
        <span className={flipped ? "pcard-index is-flipped" : "pcard-index"} aria-hidden="true" key={String(flipped)}>
          <span className="pcard-rank">J</span>
          <span className="pcard-suit is-case" />
          <span className="pcard-suit is-other" />
        </span>
      ))}
      <div className="pcard-body">
        <h3 className="pcard-title">{JOKER.title}</h3>
        <p className="pcard-line">{JOKER.line}</p>
        <a className="pcard-open" href="#contact">
          {JOKER.link}
        </a>
      </div>
    </div>
  );
}

const BACK_IN = 21;
const BACK_OUT = 30;
// Rosette frets between the pockets, zero at the top.
const FRETS = Array.from({ length: POCKETS }, (_, i) => {
  const a = -Math.PI / 2 + ((i + 0.5) * 2 * Math.PI) / POCKETS;
  return { key: i, x1: f(BACK_IN * Math.cos(a)), y1: f(BACK_IN * Math.sin(a)), x2: f(BACK_OUT * Math.cos(a)), y2: f(BACK_OUT * Math.sin(a)) };
});
const HALF = Math.PI / POCKETS;
const ZERO = wedgePath(BACK_IN, BACK_OUT, -HALF - Math.PI / 2, HALF - Math.PI / 2);

/**
 * The card back: cross-hatch, the wheel as a rosette (zero in sky) around
 * the monogram, and an inset frame. The monogram is generated content
 * (cards.css), so it is not read once per card.
 */
export const CardBack = memo(function CardBack() {
  return (
    <div className="pcard-back" aria-hidden="true">
      <svg className="pcard-back-art" viewBox="-50 -70 100 140" focusable="false">
        <rect className="pcard-back-frame" x="-43" y="-63" width="86" height="126" rx="5" />
        <rect className="pcard-back-frame is-inner" x="-39" y="-59" width="78" height="118" rx="3" />
        <g className="pcard-back-wheel">
          <path className="pcard-back-zero" d={ZERO} />
          <circle r={BACK_OUT} />
          <circle r={BACK_IN} />
          {FRETS.map((l) => (
            <line key={l.key} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
          ))}
          <circle r="11" className="pcard-back-core" />
        </g>
      </svg>
    </div>
  );
});
