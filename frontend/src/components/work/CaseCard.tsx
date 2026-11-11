import { useRef } from "react";
import { m } from "../../motion/m";
import { Reveal, TiltSurface, morphId, useMotionAllowed } from "../../motion";
import type { TiltSurfaceHandle } from "../../motion";
import { projectNumber } from "../../stats";
import { SCREENSHOTS } from "../../screenshots";
import type { ProjectSummary } from "../../types";
import type { OpenProject } from "./Work";
import { MORPH_SPRING, isOngoing, stackLine } from "./workUtils";

interface CaseCardProps {
  project: ProjectSummary;
  /** Place among the case studies, for the entrance stagger. */
  index: number;
  onOpen: OpenProject;
}

/**
 * One case study (redesign SPEC.md, section 5.3).
 *
 * Two layers. The visual layer is the figure: a screenshot when there is one,
 * otherwise a plate drawn from the project's own data (its number, its first
 * outcome, its stack), and it is the only thing TiltSurface moves. The content
 * layer beside it (title, problem, result, links, the button) never moves, so
 * its text stays crisp and every control stays where it looks.
 *
 * The article's id is what the work index rows link to, and also its layoutId:
 * the dialog shares it, so opening the case study grows this card into the
 * dialog and closing shrinks it back. The id is there from the server render
 * on, because Motion only registers a shared element when it mounts.
 */
export function CaseCard({ project: p, index, onOpen }: CaseCardProps) {
  const tiltRef = useRef<TiltSurfaceHandle>(null);
  const allowed = useMotionAllowed();
  const id = morphId(p.slug);
  const titleId = `${id}-title`;
  const number = projectNumber(p.slug);
  const shot = SCREENSHOTS[p.slug]?.[0];

  // Without a screenshot the plate shows the first outcome, so the Result
  // block takes the next one rather than printing the same sentence twice in
  // one card. With a screenshot the first outcome goes back in the block.
  const lead = p.outcomes[0] ?? p.subtitle;
  const result = shot ? p.outcomes[0] : p.outcomes[1];

  const visual = (
    <>
      {shot ? (
        <figure className="case-figure has-shot" data-number={number}>
          <img src={shot.src} alt={shot.alt} width={1600} height={1000} loading="lazy" decoding="async" />
          <span className="case-light" aria-hidden="true" />
        </figure>
      ) : (
        <div className="case-figure" data-number={number}>
          <span className="case-scale" aria-hidden="true" />
          <p className="case-figure-line">{lead}</p>
          {/* The same stack is in the content layer as text; this is its
              drawing, so assistive tech hears it once. */}
          <ul className="case-figure-stack" aria-hidden="true">
            {p.stack.map((tech) => (
              <li key={tech}>{tech}</li>
            ))}
          </ul>
          <span className="case-light" aria-hidden="true" />
        </div>
      )}
      <span className="case-glow" aria-hidden="true" />
    </>
  );

  return (
    <Reveal className="case-cell" index={index % 2} stagger={0.08} y={24}>
      <m.article
        className="case-card"
        id={id}
        layoutId={id}
        aria-labelledby={titleId}
        // In style, not CSS, so Motion can correct the corners while the card
        // is scaled during the morph.
        style={{ borderRadius: 20 }}
        transition={{ layout: allowed ? MORPH_SPRING : { duration: 0 } }}
      >
        {/* Counter-scaled during the morph, so the text inside moves with the
            card's frame instead of stretching with it. */}
        <m.div className="case-frame" layout="position">
          <TiltSurface ref={tiltRef} className="case-tilt" visual={visual} maxTilt={4}>
            <div className="case-content">
              <p className="case-readout">
                <span>
                  <span className="case-num">{number}</span>
                  {p.category && <span className="case-category"> · {p.category}</span>}
                </span>
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
                    <div className="case-block">
                      <p className="case-label">Result</p>
                      <p className="case-value">{result}</p>
                    </div>
                  )}
                </div>
              )}

              <p className="case-stack">{stackLine(p.stack, 6)}</p>

              <div className="case-footer">
                <button
                  type="button"
                  className="case-open"
                  onClick={(e) => {
                    // Level the figure first: the morph measures the card as
                    // it stands, and a tilted layer would fly in crooked.
                    tiltRef.current?.reset();
                    onOpen(p, e.currentTarget);
                  }}
                >
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
          </TiltSurface>
        </m.div>
      </m.article>
    </Reveal>
  );
}
