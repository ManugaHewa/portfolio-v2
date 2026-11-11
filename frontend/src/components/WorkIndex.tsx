import { Odometer, Reveal, SplitTitle, morphId } from "../motion";
import { STATS, projectNumber } from "../stats";
import type { ProjectSummary } from "../types";

interface WorkIndexProps {
  /** The six case studies, in content order. */
  cases: ProjectSummary[];
}

/**
 * The first place the projects appear: one row per case study, each a single
 * link down to its card. Rises over the pinned hero (redesign SPEC.md, 5.2).
 *
 * The section spans the page so it can sit in the same 12-column grid as the
 * hero stage; the sheet inside it takes the copy column's seven columns and
 * carries the page background, so the copy it rises over goes under it
 * rather than showing through.
 *
 * Each row is one link, named by the title and described by the problem, so
 * a screen reader hears "RxFlow, link" and then the one-line problem, not
 * the number and the category in between.
 */
export function WorkIndex({ cases }: WorkIndexProps) {
  return (
    <section className="work-index" id="work-index" aria-labelledby="work-index-heading">
      <div className="container work-index-grid">
        <div className="work-index-sheet">
          <div className="work-index-head">
            <SplitTitle as="h2" id="work-index-heading" className="section-title" text="Selected work" />
            <p className="work-index-readout readout">
              <span className="work-index-reading">
                <Odometer value={STATS.projects} className="readout-num" /> projects on this page
              </span>
              <span className="work-index-sep" aria-hidden="true">
                {" · "}
              </span>
              <span className="work-index-reading">
                <Odometer value={STATS.caseStudies} className="readout-num" /> case studies
              </span>
              <span className="work-index-sep" aria-hidden="true">
                {" · "}
              </span>
              <span className="work-index-reading">
                <Odometer value={STATS.repositories} className="readout-num" /> repositories
              </span>
            </p>
          </div>

          <ol className="work-index-list">
            {cases.map((p, i) => {
              const titleId = `work-index-${p.slug}-title`;
              const problemId = `work-index-${p.slug}-problem`;
              const meta = [p.category, p.status].filter(Boolean).join(" · ");
              return (
                <Reveal as="li" className="work-index-item" index={i} stagger={0.06} y={16} key={p.slug}>
                  <a
                    className="work-index-row"
                    href={`#${morphId(p.slug)}`}
                    aria-labelledby={titleId}
                    aria-describedby={p.problem ? problemId : undefined}
                  >
                    <span className="work-index-num mono" aria-hidden="true">
                      {projectNumber(p.slug)}
                    </span>
                    <span className="work-index-title" id={titleId}>
                      {p.title}
                    </span>
                    <span className="work-index-go" aria-hidden="true" />
                    {meta && <span className="work-index-meta mono">{meta}</span>}
                    {p.problem && (
                      <span className="work-index-problem" id={problemId}>
                        {p.problem}
                      </span>
                    )}
                  </a>
                </Reveal>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
