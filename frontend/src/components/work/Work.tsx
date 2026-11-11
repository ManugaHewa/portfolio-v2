import { SectionHead } from "../../motion";
import { Scene } from "../Scene";
import { CaseCard } from "./CaseCard";
import { OtherWork } from "./OtherWork";
import type { ProjectSummary } from "../../types";

/**
 * Opens a project's dialog. `trigger` is the control that was pressed, so
 * focus can go back to it when the dialog closes.
 */
export type OpenProject = (project: ProjectSummary, trigger: HTMLElement) => void;

interface WorkProps {
  /** Tier 1, in content order. */
  cases: ProjectSummary[];
  /** Tier 2, in content order. */
  otherWork: ProjectSummary[];
  /** No project list yet: nothing was prerendered and the API has not answered. */
  loading: boolean;
  /** The API failed and there was no prerendered list to fall back on. */
  error: boolean;
  onOpen: OpenProject;
}

/** A card-shaped placeholder: the same frame, figure and line rhythm as a case card. */
function CaseSkeleton() {
  return (
    <div className="case-cell">
      <div className="case-card case-skeleton">
        <div className="case-skeleton-figure" />
        <div className="case-skeleton-body">
          <span className="case-skeleton-line is-short" />
          <span className="case-skeleton-line is-title" />
          <span className="case-skeleton-line" />
          <span className="case-skeleton-line" />
          <span className="case-skeleton-line is-mid" />
        </div>
      </div>
    </div>
  );
}

/**
 * The case studies and the other work (redesign SPEC.md, section 5.3).
 *
 * The six case studies sit on a twelve-column grid in three different
 * pairings (7 and 5, 5 and 7, 6 and 6), so no row repeats the one above it,
 * and each card is as tall as its own content. The field scene is pinned
 * behind the section one viewport tall rather than stretched over all of it:
 * a canvas the height of the section would mean a drawing buffer several
 * screens tall for a backdrop you only ever see one screen of.
 */
export function Work({ cases, otherWork, loading, error, onOpen }: WorkProps) {
  const empty = cases.length === 0 && otherWork.length === 0;

  return (
    <section className="section work" id="work" aria-labelledby="work-heading">
      <Scene variant="field" className="scene-sticky scene-field" />
      <div className="container work-inner">
        <SectionHead
          titleId="work-heading"
          title="Case studies"
          intro="What each project was for, what I built, and what happened."
        />

        {error && empty && (
          <p className="work-state" role="alert">
            Couldn&rsquo;t load the projects. Reloading the page usually fixes it.
          </p>
        )}

        {/* Placeholders rather than an empty grid: the section otherwise
            collapses to its heading and then jumps when the data lands. */}
        {loading && empty && !error && (
          <>
            <div className="case-grid" aria-hidden="true">
              <CaseSkeleton />
              <CaseSkeleton />
            </div>
            <p className="visually-hidden" role="status">
              Loading projects
            </p>
          </>
        )}

        {!loading && !error && empty && <p className="work-state">No projects to show yet.</p>}

        {cases.length > 0 && (
          <div className="case-grid">
            {cases.map((p, i) => (
              <CaseCard key={p.slug} project={p} index={i} onOpen={onOpen} />
            ))}
          </div>
        )}

        {!empty && <OtherWork projects={otherWork} onOpen={onOpen} />}
      </div>
    </section>
  );
}
