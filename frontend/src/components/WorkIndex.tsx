import type { Ref } from "react";
import { Odometer, SplitTitle } from "../motion";
import type { MotionValue } from "../motion/m";
import { STATS } from "../stats";
import type { ProjectSummary } from "../types";
import type { OpenProject } from "./work/Work";
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
  /** Every project, case studies first, in page order. */
  projects: ProjectSummary[];
  onOpen: OpenProject;
  /** The heading block, which the hero times its copy's fade against. */
  headRef?: Ref<HTMLDivElement>;
  /** The pinned hero's cue for the card table (Hero.tsx); absent elsewhere. */
  reveal?: MotionValue<number>;
}

/**
 * The first place the projects appear: a deck of cards, one per project
 * (components/deck). Rises over the pinned hero (redesign SPEC.md, 5.2).
 *
 * The section spans the page so it can sit in the same 12-column grid as the
 * hero stage. The sheet takes the copy column (the heading, the three
 * gauges read from the data, and the deck's controls) and carries the page
 * background, so the copy it rises over goes under it rather than showing
 * through. The card table takes the other five columns, which the gyroscope
 * leaves as it flies into the header; below 1100px it follows the sheet.
 */
export function WorkIndex({ projects, onOpen, headRef, reveal }: WorkIndexProps) {
  const deck = useDeck(projects.length);
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
          {projects.length > 0 && <DeckControls projects={projects} deck={deck} />}
        </div>
        {projects.length > 0 && (
          <div className="work-index-table">
            <DeckTable projects={projects} deck={deck} onOpen={onOpen} reveal={reveal} />
          </div>
        )}
      </div>
    </section>
  );
}
