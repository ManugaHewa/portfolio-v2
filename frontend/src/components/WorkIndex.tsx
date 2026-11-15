import { useMemo } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, Ref } from "react";
import { Odometer, SplitTitle, useMotionAllowed } from "../motion";
import type { MotionValue } from "../motion/m";
import { STATS } from "../stats";
import type { OpenProject, ProjectSummary } from "../types";
import { DeckControls } from "./deck/DeckControls";
import { DeckTable } from "./deck/DeckTable";
import { useDeck } from "./deck/useDeck";

// The three readings under the heading.
const READINGS: Array<[number, string]> = [
  [STATS.projects, "projects on this page"],
  [STATS.caseStudies, "case studies"],
  [STATS.repositories, "repositories"],
];

interface WorkIndexProps {
  /** Every project, in API order. */
  projects: ProjectSummary[];
  /** No list yet: nothing prerendered and no API answer. */
  loading?: boolean;
  /** The API failed with no prerendered list to fall back on. */
  error?: boolean;
  onOpen: OpenProject;
  /** The heading block, which the hero times its copy fade against. */
  headRef?: Ref<HTMLDivElement>;
  /** The pinned hero's cue for the card table (Hero.tsx). */
  reveal?: MotionValue<number>;
}

/**
 * The deck action a key press means, if any. Only with focus in the section
 * (WCAG 2.1.4), never with a modifier or from a text field.
 */
export function deckKey(e: Pick<ReactKeyboardEvent, "key" | "altKey" | "ctrlKey" | "metaKey" | "repeat" | "target">) {
  if (e.altKey || e.ctrlKey || e.metaKey || e.repeat) return null;
  if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]")) return null;
  const k = e.key.toLowerCase();
  return k === "d" ? "draw" : k === "s" ? "spread" : k === "r" ? "shuffle" : k === "c" ? "cut" : null;
}

/**
 * The work: every project as a card in one deck (components/deck), each
 * opening its case study and with its own page (/work/<slug>/). Rises over
 * the pinned hero.
 *
 * Spans the page to share the hero's 12-column grid. The sheet (heading,
 * readings, deck controls) carries the page background, so the copy it
 * rises over goes under it; the card table takes the five columns the wheel
 * leaves. Below 1100px the table follows the sheet.
 *
 * Cards are in number order (case studies, then other work). With focus in
 * the section, D draws, S spreads or gathers, R shuffles, C cuts (deckKey).
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
    } else if (action === "cut") deck.cut();
    else deck.shuffle();
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
