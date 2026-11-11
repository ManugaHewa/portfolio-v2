import { projectNumber } from "../../stats";
import { ALSO_ON_GITHUB } from "../../repositories";
import type { ProjectSummary } from "../../types";
import type { OpenProject } from "./Work";

interface OtherWorkProps {
  /** Tier 2, in content order. */
  projects: ProjectSummary[];
  onOpen: OpenProject;
}

/**
 * Smaller projects (each opens its dialog) and the repository rows (each a
 * link out), one list at one weight (redesign SPEC.md, section 5.3).
 *
 * Stub from the scaffold: the final ids, headings and rows; no styling yet.
 */
export function OtherWork({ projects, onOpen }: OtherWorkProps) {
  return (
    <section className="other-work" id="other-work" aria-labelledby="other-work-heading">
      <h3 className="subsection-title" id="other-work-heading">
        Other work
      </h3>
      <p className="other-work-intro">Smaller projects and repositories.</p>

      <ul className="other-list">
        {projects.map((p) => (
          <li className="other-row" id={`other-${p.slug}`} key={p.slug}>
            <span className="other-num mono">{projectNumber(p.slug)}</span>
            <button type="button" className="other-title" onClick={(e) => onOpen(p, e.currentTarget)}>
              {p.title}
            </button>
            <p className="other-summary">{p.subtitle}</p>
            {p.category && <span className="other-category mono">{p.category}</span>}
            <span className="other-stack mono">{p.stack.slice(0, 3).join(" · ")}</span>
          </li>
        ))}

        {ALSO_ON_GITHUB.map((r) => (
          <li className="other-row is-repo" key={r.name}>
            <span className="other-num mono">Repo</span>
            <a className="other-title" href={r.url} target="_blank" rel="noreferrer">
              {r.name}
            </a>
            <p className="other-summary">{r.note}</p>
            <span className="other-category mono">Repository · {r.year}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
