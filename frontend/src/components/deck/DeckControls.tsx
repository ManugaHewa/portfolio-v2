import { projectNumber } from "../../stats";
import type { ProjectSummary } from "../../types";
import { caseStudyPath } from "../../lib/paths";
import { Suit } from "./PlayingCard";
import { RollLabel } from "../RollLabel";
import type { Deck } from "./useDeck";

interface DeckControlsProps {
  projects: ProjectSummary[];
  deck: Deck;
}

/**
 * The deck's controls, beside the heading: what the deck is, the Draw and
 * Shuffle buttons, how far through it the visitor is, and every project as
 * a plain list for anyone who would rather not draw (a native disclosure,
 * so it opens without JavaScript too), each linking to the project's own
 * page.
 *
 * Each draw is said once, politely, by the visually hidden line; the
 * opening card, already on the table when the page loads, is not announced.
 */
export function DeckControls({ projects, deck }: DeckControlsProps) {
  const current = deck.current === null ? undefined : projects[deck.current];
  const moved = deck.deal > 0 || deck.drawn > 1;
  const said = moved && current ? `Card ${deck.drawn} of ${deck.size}: ${current.title}.` : "";
  const empty = deck.remaining === 0;

  return (
    <div className="deck-controls">
      <p className="deck-intro">
        {deck.size} projects, one deck. Draw a card to turn the next one over, or throw it off the top.
      </p>
      <div className="deck-actions">
        <button type="button" className="btn btn-primary" onClick={empty ? deck.shuffle : deck.draw}>
          <RollLabel>{empty ? "Shuffle and deal again" : "Draw a card"}</RollLabel>
        </button>
        <button type="button" className="btn btn-secondary" onClick={deck.shuffle}>
          <RollLabel>Shuffle</RollLabel>
        </button>
        <span className="deck-count mono" aria-hidden="true">
          {String(deck.drawn).padStart(2, "0")} / {String(deck.size).padStart(2, "0")}
        </span>
      </div>
      <p className="visually-hidden" aria-live="polite">
        {said}
      </p>

      <details className="deck-list">
        <summary className="mono">All {deck.size} projects</summary>
        <ol>
          {projects.map((p) => (
            <li key={p.slug}>
              <a href={caseStudyPath(p.slug)}>
                <span className="deck-list-num mono" aria-hidden="true">
                  {projectNumber(p.slug)}
                </span>
                <Suit tier={p.tier} />
                <span className="deck-list-title">{p.title}</span>
              </a>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
