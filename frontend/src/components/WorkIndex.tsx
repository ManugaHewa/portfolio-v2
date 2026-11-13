import { useMemo } from "react";
import type { Ref } from "react";
import { Odometer, SplitTitle, useMotionAllowed } from "../motion";
import type { MotionValue } from "../motion/m";
import { STATS } from "../stats";
import type { OpenProject, ProjectSummary } from "../types";
import { DeckControls } from "./deck/DeckControls";
import { DeckTable } from "./deck/DeckTable";
import { useDeck } from "./deck/useDeck";

// The three gauges under the heading, in reading order.
const READINGS: Array<[number, string]> = [
  [STATS.projects, "projects on this page"],
  [STATS.caseStudies, "case studies"],
  [STATS.repositories, "repositories"],
];

interface WorkIndexProps {
  /** Every project, in the order the API sent them. */
  projects: ProjectSummary[];
  /** No project list yet: nothing was prerendered and the API has not answered. */
  loading?: boolean;
  /** The API failed and there was no prerendered list to fall back on. */
  error?: boolean;
  onOpen: OpenProject;
  /** The heading block, which the hero times its copy's fade against. */
  headRef?: Ref<HTMLDivElement>;
  /** The pinned hero's cue for the card table (Hero.tsx); absent elsewhere. */
  reveal?: MotionValue<number>;
}

/**
 * The work: every project as a card in one deck (components/deck), the one
 * place the projects are shown; each opens its case study, and each has a
 * page of its own (/work/<slug>/). Rises over the pinned hero (redesign
 * SPEC.md, 5.2).
 *
 * The section spans the page so it can sit in the same 12-column grid as the
 * hero stage. The sheet takes the copy column (the heading, the three
 * gauges read from the data, and the deck's controls) and carries the page
 * background, so the copy it rises over goes under it rather than showing
 * through. The card table takes the other five columns, which the gyroscope
 * leaves as it flies into the header; below 1100px it follows the sheet.
 *
 * The cards are in number order (the case studies, then the other work),
 * whatever order the list arrived in, so the deck's numbers count up.
 */
export function WorkIndex({ projects, loading = false, error = false, onOpen, headRef, reveal }: WorkIndexProps) {
  const ordered = useMemo(
    () => [...projects.filter((p) => p.tier === 1), ...projects.filter((p) => p.tier !== 1)],
    [projects],
  );
  const deck = useDeck(ordered.length, !useMotionAllowed());
  const empty = ordered.length === 0;

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
          {!empty && <DeckControls projects={ordered} deck={deck} />}
          {empty && error && (
            <p className="work-state" role="alert">
              Couldn&rsquo;t load the projects. Reloading the page usually fixes it.
            </p>
          )}
          {empty && loading && !error && (
            <p className="work-state" role="status">
              Dealing the projects&hellip;
            </p>
          )}
        </div>
        {!empty && (
          <div className="work-index-table">
            <DeckTable projects={ordered} deck={deck} onOpen={onOpen} reveal={reveal} />
          </div>
        )}
      </div>
    </section>
  );
}
