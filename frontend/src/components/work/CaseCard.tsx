import { m } from "../../motion/m";
import { useRef } from "react";
import type { CSSProperties } from "react";
import { PIN_QUERY, Reveal, morphId, useMediaQuery, useMotionAllowed } from "../../motion";
import { SCREENSHOTS } from "../../screenshots";
import type { ProjectSummary } from "../../types";
import type { OpenProject } from "./Work";
import { FigureContents } from "./CaseFigure";
import { FIGURE_RADIUS, FIGURE_RADIUS_STACKED, MORPH_SPRING, figureId, isOngoing, stackLine } from "./workUtils";

interface CaseCardProps {
  project: ProjectSummary;
  /** Place among the case studies, for the entrance stagger. */
  index: number;
  onOpen: OpenProject;
}

/**
 * One case study (redesign SPEC.md, section 5.3): one card, its figure the
 * top edge and its text below.
 *
 * The figure is the project's picture (CaseFigure.tsx): its number and what
 * it is. Hovering the card, or moving keyboard focus into it, locks on to the
 * figure (work.css): four ember corner marks close in on the plate, a sweep
 * runs along its scale and the number fills from its tint to solid ember.
 * Nothing follows the cursor. The text below says
 * the rest once each: category and status, title, role, the problem and the
 * result, the stack, then the button and the links. It never moves, so it
 * stays crisp and every control stays where it looks.
 *
 * The figure carries the shared layoutId: opening the case study grows it out
 * of the card into the head of the dialog, and closing shrinks it back. It
 * has the id from the server render on, because Motion only registers a
 * shared element when it mounts. The article's id is what the work index
 * rows link to, and what the dialog checks to know it was opened from here.
 */
export function CaseCard({ project: p, index, onOpen }: CaseCardProps) {
  const openRef = useRef<HTMLButtonElement>(null);
  const allowed = useMotionAllowed();
  // The deck (Work.tsx) lays the card out sideways, figure on the left.
  const stacked = useMediaQuery(PIN_QUERY);
  const id = morphId(p.slug);
  const titleId = `${id}-title`;
  const shot = SCREENSHOTS[p.slug]?.[0];
  const result = p.outcomes[0];

  const open = () => {
    const button = openRef.current;
    if (!button) return;
    onOpen(p, button);
  };

  return (
    <Reveal className="case-cell" index={index % 2} stagger={0.08} y={24} style={{ "--n": index } as CSSProperties}>
      <article className="case-card" id={id} aria-labelledby={titleId}>
        {/* A pointer can open the case study from the picture too. It sits
            above the button's stretched target; the button stays the one control for the keyboard and for a
            screen reader, and is what focus returns to. */}
        <m.div
          className={shot ? "case-figure has-shot" : "case-figure"}
          layoutId={figureId(p.slug)}
          style={stacked ? FIGURE_RADIUS_STACKED : FIGURE_RADIUS}
          transition={{ layout: allowed ? MORPH_SPRING : { duration: 0 } }}
          onClick={open}
        >
          <FigureContents project={p} shot={shot} holdShape />
          <span className="case-lock" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
        </m.div>

        <div className="case-content">
          <p className="case-readout">
            {p.category && <span className="case-category">{p.category}</span>}
            {p.status && (
              <span className={isOngoing(p.status) ? "case-status is-ongoing" : "case-status"}>
                {p.status}
              </span>
            )}
          </p>

          <div className="case-heading">
            <h3 className="case-title" id={titleId}>
              {p.title}
            </h3>
            {/* A screenshot does not say what the project is; the plate
                does, so the line moves down here only when there is one. */}
            {shot && <p className="case-subtitle">{p.subtitle}</p>}
            {(p.role || p.timeline) && (
              <p className="case-role small">{[p.role, p.timeline].filter(Boolean).join(" · ")}</p>
            )}
          </div>

          {(p.problem || result) && (
            <div className="case-blocks">
              {p.problem && (
                <div className="case-block">
                  <p className="case-label">Problem</p>
                  <p className="case-value">{p.problem}</p>
                </div>
              )}
              {result && (
                <div className="case-block is-result">
                  <p className="case-label">Result</p>
                  <p className="case-value">{result}</p>
                </div>
              )}
            </div>
          )}

          {p.stack.length > 0 && <p className="case-stack">{stackLine(p.stack, 6)}</p>}

          <div className="case-footer">
            <button type="button" className="case-open" ref={openRef} onClick={open}>
              Read the case study<span className="visually-hidden"> for {p.title}</span>
              <span className="case-open-arrow" aria-hidden="true" />
            </button>
            {p.links.length > 0 && (
              <ul className="case-links">
                {p.links.map((link) => (
                  <li key={link.label}>
                    {link.url ? (
                      <a className="case-link" href={link.url} target="_blank" rel="noreferrer">
                        {link.label}
                      </a>
                    ) : (
                      <span className="case-link is-pending">
                        {link.label}
                        <span className="visually-hidden"> (link not published yet)</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </article>
    </Reveal>
  );
}
