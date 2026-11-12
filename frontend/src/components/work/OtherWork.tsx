import { projectNumber } from "../../stats";
import { ALSO_ON_GITHUB } from "../../repositories";
import type { ProjectSummary } from "../../types";
import type { OpenProject } from "./Work";
import { Suit } from "../deck/PlayingCard";

interface OtherWorkProps {
  /** Tier 2, in content order. */
  projects: ProjectSummary[];
  onOpen: OpenProject;
}

/**
 * Smaller projects (each opens its dialog) and the repository rows (each a
 * link out), one list at one weight (redesign SPEC.md, section 5.3). A table
 * of hairline rows rather than more cards: after six case studies, seven
 * more cards would read as padding.
 *
 * Each row's title control is stretched over the whole row, so the row is
 * the target, and there is still exactly one control per row for the
 * keyboard and for a screen reader's list of buttons and links.
 */
export function OtherWork({ projects, onOpen }: OtherWorkProps) {
  return (
    <section className="other-work" id="other-work" aria-labelledby="other-work-heading">
      <div className="other-head">
        <h3 className="other-heading" id="other-work-heading">
          Other work
        </h3>
        <p className="other-intro">Smaller projects and repositories.</p>
      </div>

      <ul className="other-list">
        {projects.map((p) => (
          <li className="other-row" id={`other-${p.slug}`} key={p.slug}>
            <span className="other-num">
              {projectNumber(p.slug)}
              <Suit tier={p.tier} />
            </span>
            <button
              type="button"
              className="other-title"
              aria-haspopup="dialog"
              onClick={(e) => onOpen(p, e.currentTarget)}
            >
              {p.title}
            </button>
            <p className="other-summary">{p.subtitle}</p>
            <p className="other-meta">
              {p.category && <span className="other-category">{p.category}</span>}
            </p>
          </li>
        ))}

        {ALSO_ON_GITHUB.map((r) => (
          <li className="other-row is-repo" key={r.name}>
            <span className="other-num">Repo</span>
            <a className="other-title" href={r.url} target="_blank" rel="noreferrer">
              {r.name}
              <span className="other-arrow" aria-hidden="true" />
              <span className="visually-hidden"> (on GitHub, opens in a new tab)</span>
            </a>
            <p className="other-summary">{r.note}</p>
            <p className="other-meta">
              <span className="other-category">Repository · {r.year}</span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
