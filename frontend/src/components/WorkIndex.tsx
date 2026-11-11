import type { ReactNode, Ref } from "react";
import { Odometer, Reveal, SplitTitle, morphId } from "../motion";
import { STATS, projectNumber } from "../stats";
import type { ProjectSummary } from "../types";

// The three gauges under the heading, in reading order.
const READINGS: Array<[number, string]> = [
  [STATS.projects, "projects on this page"],
  [STATS.caseStudies, "case studies"],
  [STATS.repositories, "repositories"],
];

/**
 * The problem as wrapping text, with each hyphenated word ("e-transfers")
 * held on one line. The cut-off line ends wherever the text wraps, and a
 * browser may wrap after a hyphen, which would end the row on half a word.
 * Spans rather than a non-breaking hyphen, so the text, and the link's
 * name, stay exactly as written.
 */
function wholeWords(text: string): ReactNode[] {
  return text.split(/(\S+-\S+)/).map((part, i) =>
    i % 2 === 1 ? (
      <span className="work-index-word" key={i}>
        {part}
      </span>
    ) : (
      part
    ),
  );
}

interface WorkIndexProps {
  /** The six case studies, in content order. */
  cases: ProjectSummary[];
  /** The heading block, which the hero times its copy's fade against. */
  headRef?: Ref<HTMLDivElement>;
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
 * Under the heading, three gauges (a numeral over its label) read the counts
 * from the data. Each row is one link, named by its own visible text (title,
 * then category and status, then the problem), so every word on the row is
 * in its name; the number is decoration and hidden from assistive tech. The
 * problem shows as one line cut on a word, two on a phone, and is whole in
 * the name.
 */
export function WorkIndex({ cases, headRef }: WorkIndexProps) {
  return (
    <section className="work-index" id="work-index" aria-labelledby="work-index-heading">
      <div className="container work-index-grid">
        <div className="work-index-sheet">
          <div className="work-index-head" ref={headRef}>
            <SplitTitle as="h2" id="work-index-heading" className="section-title" text="Selected work" />
            <p className="work-index-readout readout">
              {READINGS.map(([value, label]) => (
                <span className="work-index-reading" key={label}>
                  <Odometer value={value} className="readout-num" />{" "}
                  <span className="work-index-label">{label}</span>
                </span>
              ))}
            </p>
          </div>

          <ol className="work-index-list">
            {cases.map((p, i) => {
              const meta = [p.category, p.status].filter(Boolean).join(" · ");
              return (
                <Reveal as="li" className="work-index-item" index={i} stagger={0.06} y={16} key={p.slug}>
                  {/*
                    Named by its own text: title, then category and status, then
                    the problem. Naming it by the title alone (aria-labelledby)
                    would leave visible words out of the name, which fails
                    WCAG 2.5.3 Label in Name (axe label-content-name-mismatch).
                    The number is decoration; the title says which project.
                  */}
                  <a className="work-index-row" href={`#${morphId(p.slug)}`}>
                    <span className="work-index-num mono" aria-hidden="true">
                      {projectNumber(p.slug)}
                    </span>
                    <span className="work-index-title">
                      {p.title}
                    </span>
                    <span className="work-index-go" aria-hidden="true" />
                    {meta && <span className="work-index-meta mono">{meta}</span>}
                    {p.problem && (
                      <span className="work-index-problem">{wholeWords(p.problem)}</span>
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
