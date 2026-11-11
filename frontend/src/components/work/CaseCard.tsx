import { TiltSurface, morphId } from "../../motion";
import { projectNumber } from "../../stats";
import { SCREENSHOTS } from "../../screenshots";
import type { ProjectSummary } from "../../types";
import type { OpenProject } from "./Work";

interface CaseCardProps {
  project: ProjectSummary;
  /** Place among the case studies, for the entrance stagger. */
  index: number;
  onOpen: OpenProject;
}

// Anything not yet finished: every finished project's status starts "Completed".
const ONGOING = /^(?!completed)/i;

/**
 * One case study (redesign SPEC.md, section 5.3): a visual layer that may
 * tilt, and a content layer beside it that never moves. The root's id is the
 * work index rows' target and the dialog's morph id.
 *
 * Stub from the scaffold: the final structure and text, no tilt, entrance or
 * morph yet.
 */
export function CaseCard({ project: p, onOpen }: CaseCardProps) {
  const number = projectNumber(p.slug);
  const titleId = `${morphId(p.slug)}-title`;
  const shot = SCREENSHOTS[p.slug]?.[0];
  const ongoing = p.status ? ONGOING.test(p.status) : false;
  const stackLine =
    p.stack.slice(0, 6).join(" · ") + (p.stack.length > 6 ? ` +${p.stack.length - 6}` : "");

  const visual = (
    <figure className="case-figure" data-number={number}>
      {shot ? (
        <img src={shot.src} alt={shot.alt} width={1600} height={1000} loading="lazy" decoding="async" />
      ) : (
        <>
          <p className="case-figure-line">{p.outcomes[0] ?? p.subtitle}</p>
          <p className="case-figure-stack mono" aria-hidden="true">
            {p.stack.join(" | ")}
          </p>
        </>
      )}
    </figure>
  );

  return (
    <article className="case-card" id={morphId(p.slug)} aria-labelledby={titleId}>
      <TiltSurface visual={visual} maxTilt={4}>
        <div className="case-content">
          <p className="case-readout mono">
            <span>
              {number}
              {p.category && ` · ${p.category}`}
            </span>
            {p.status && (
              <span className={ongoing ? "case-status is-ongoing" : "case-status"}>{p.status}</span>
            )}
          </p>
          <h3 className="case-title" id={titleId}>
            {p.title}
          </h3>
          {(p.role || p.timeline) && (
            <p className="case-role small">{[p.role, p.timeline].filter(Boolean).join(" · ")}</p>
          )}
          {p.problem && (
            <div className="case-block">
              <p className="case-label mono">Problem</p>
              <p className="case-value">{p.problem}</p>
            </div>
          )}
          {p.outcomes[0] && (
            <div className="case-block">
              <p className="case-label mono">Result</p>
              <p className="case-value">{p.outcomes[0]}</p>
            </div>
          )}
          <p className="case-stack mono">{stackLine}</p>
          <div className="case-footer">
            <button
              type="button"
              className="case-open"
              onClick={(e) => onOpen(p, e.currentTarget)}
            >
              Read the case study<span className="visually-hidden"> for {p.title}</span>
            </button>
            {p.links.map((link) =>
              link.url ? (
                <a className="case-link" key={link.label} href={link.url} target="_blank" rel="noreferrer">
                  {link.label}
                </a>
              ) : (
                <span className="case-link is-pending" key={link.label}>
                  {link.label}
                  <span className="visually-hidden"> (link not published yet)</span>
                </span>
              ),
            )}
          </div>
        </div>
      </TiltSurface>
    </article>
  );
}
