import { useMemo } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, Ref } from "react";
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
 * The deck's keyboard shortcut a key press means, if any. Single keys work
 * only while focus is in the work section (the handler sits on it), as
 * WCAG 2.1.4 asks of single-character shortcuts, and never with a modifier
 * held or from a text field.
 */
export function deckKey(e: Pick<ReactKeyboardEvent, "key" | "altKey" | "ctrlKey" | "metaKey" | "repeat" | "target">) {
  if (e.altKey || e.ctrlKey || e.metaKey || e.repeat) return null;
  if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]")) return null;
  const k = e.key.toLowerCase();
  return k === "d" ? "draw" : k === "s" ? "spread" : k === "r" ? "shuffle" : null;
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
 *
 * While focus is anywhere in the section, D draws, S spreads (or gathers)
 * and R shuffles (deckKey).
 */
export function WorkIndex({ projects, loading = false, error = false, onOpen, headRef, reveal }: WorkIndexProps) {
  const ordered = useMemo(
    () => [...projects.filter((p) => p.tier === 1), ...projects.filter((p) => p.tier !== 1)],
    [projects],
  );
  const deck = useDeck(ordered.length, !useMotionAllowed());
  const empty = ordered.length === 0;

  const onKeyDown = (e: ReactKeyboardEvent) => {
    const action = deckKey(e);
    if (!action || empty || e.defaultPrevented) return;
    e.preventDefault();
    if (action === "draw") (deck.remaining > 0 ? deck.draw : deck.shuffle)();
    else if (action === "spread") {
      if (deck.remaining >= 2) deck.setSpread(!deck.spread);
    } else deck.shuffle();
  };

  return (
    <section className="work-index" id="work-index" aria-labelledby="work-index-heading" onKeyDown={onKeyDown}>
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
