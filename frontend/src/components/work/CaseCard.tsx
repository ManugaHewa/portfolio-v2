import { useRef } from "react";
import { m } from "../../motion/m";
import { Reveal, TiltSurface, morphId, useMotionAllowed } from "../../motion";
import type { TiltSurfaceHandle } from "../../motion";
import { SCREENSHOTS } from "../../screenshots";
import type { ProjectSummary } from "../../types";
import type { OpenProject } from "./Work";
import { FigureContents } from "./CaseFigure";
import { FIGURE_RADIUS, MORPH_SPRING, figureId, isOngoing, stackLine } from "./workUtils";

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
 * it is. Its plate stays put and only what is drawn on it tilts toward the
 * cursor, so the plate's edge always meets the card's. The text below says
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
  const tiltRef = useRef<TiltSurfaceHandle>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const allowed = useMotionAllowed();
  const id = morphId(p.slug);
  const titleId = `${id}-title`;
  const shot = SCREENSHOTS[p.slug]?.[0];
  const result = p.outcomes[0];

  const open = () => {
    const button = openRef.current;
    if (!button) return;
    // Level the drawing first: the morph measures the figure as it stands,
    // and a tilted layer would fly in crooked.
    tiltRef.current?.reset();
    onOpen(p, button);
  };

  return (
    <Reveal className="case-cell" index={index % 2} stagger={0.08} y={24}>
      <article className="case-card" id={id} aria-labelledby={titleId}>
        {/* A pointer can open the case study from the picture too. It sits
            above the button's stretched target so the tilt sees the cursor;
            the button stays the one control for the keyboard and for a
            screen reader, and is what focus returns to. */}
        <m.div
          className={shot ? "case-figure has-shot" : "case-figure"}
          layoutId={figureId(p.slug)}
          style={FIGURE_RADIUS}
          transition={{ layout: allowed ? MORPH_SPRING : { duration: 0 } }}
          onClick={open}
        >
          <TiltSurface
            ref={tiltRef}
            className="case-figure-tilt"
            visual={<FigureContents project={p} shot={shot} holdShape />}
            maxTilt={4}
          >
            <span className="case-light" aria-hidden="true" />
            <span className="case-glow" aria-hidden="true" />
          </TiltSurface>
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
