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
 * Stub from the scaffold: the final content, ids and link wiring; hero.css
 * and the row entrance come from the hero agent.
 */
export function WorkIndex({ cases }: WorkIndexProps) {
  return (
    <section className="work-index" id="work-index" aria-labelledby="work-index-heading">
      <div className="work-index-head">
        <SplitTitle as="h2" id="work-index-heading" className="section-title" text="Selected work" />
        <p className="work-index-readout readout">
          <Odometer value={STATS.projects} className="readout-num" /> projects on this page ·{" "}
          <Odometer value={STATS.caseStudies} className="readout-num" /> case studies ·{" "}
          <Odometer value={STATS.repositories} className="readout-num" /> repositories
        </p>
      </div>

      <ol className="work-index-list">
        {cases.map((p, i) => {
          const titleId = `work-index-${p.slug}-title`;
          const problemId = `work-index-${p.slug}-problem`;
          const meta = [p.category, p.status].filter(Boolean).join(" · ");
          return (
            <Reveal as="li" className="work-index-item" index={i} stagger={0.06} key={p.slug}>
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
    </section>
  );
}
