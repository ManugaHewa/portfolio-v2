import { ALSO_ON_GITHUB } from "../../repositories";
import { projectNumber } from "../../stats";
import type { ProjectSummary } from "../../types";
import { caseStudyPath } from "../../lib/paths";
import { RollLabel } from "../RollLabel";
import { Suit } from "./PlayingCard";
import type { Deck } from "./useDeck";

interface DeckControlsProps {
  projects: ProjectSummary[];
  deck: Deck;
}

/**
 * Deck controls beside the heading: Draw, Spread, Shuffle, progress, and a
 * plain list of every project (a native disclosure, works without JS) plus
 * the other repositories. A hidden polite line announces draws, shuffles
 * and cuts; the opening card is not announced.
 */
export function DeckControls({ projects, deck }: DeckControlsProps) {
  const current = deck.current === null ? undefined : projects[deck.current];
  const moved = deck.deal > 0 || deck.drawn > 1;
  const shuffled = deck.deal > 0 && deck.drawn === 1 ? "Shuffled. " : "";
  // Announced while the cut is the latest action; a trailing NBSP on alternate cuts re-announces a repeat.
  const cutLast = deck.cuts > 0 && deck.cutMark === `${deck.deal}:${deck.drawn}`;
  const said = cutLast
    ? `Cut the deck. A different card is on top.${deck.cuts % 2 === 0 ? "\u00a0" : ""}`
    : moved && current
      ? `${shuffled}Card ${deck.drawn} of ${deck.size}: ${current.title}.`
      : "";
  const empty = deck.remaining === 0;

  return (
    <div className="deck-controls">
      <p className="deck-intro">
        {deck.size} projects, one deck. Draw the top card, spread them out and pick one, or throw a card off
        the top.
      </p>
      <div className="deck-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={empty ? deck.shuffle : deck.draw}
          aria-disabled={deck.riffling || undefined}
          aria-keyshortcuts="D"
        >
          <RollLabel>{empty ? "Shuffle and deal again" : "Draw a card"}</RollLabel>
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => deck.setSpread(!deck.spread)}
          aria-pressed={deck.spread}
          disabled={deck.remaining < 2}
          aria-keyshortcuts="S"
        >
          <RollLabel>{deck.spread ? "Gather the deck" : "Spread the deck"}</RollLabel>
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={deck.shuffle}
          aria-disabled={deck.riffling || undefined}
          aria-keyshortcuts="R"
        >
          <RollLabel>Shuffle</RollLabel>
        </button>
        <span className="deck-count mono" aria-hidden="true">
          {String(deck.drawn).padStart(2, "0")} / {String(deck.size).padStart(2, "0")}
        </span>
      </div>
      {/* Shown while focus is in the section; buttons expose the keys to assistive tech. */}
      <p className="deck-keys mono" aria-hidden="true">
        <kbd>D</kbd> draw <kbd>S</kbd> spread <kbd>R</kbd> shuffle <kbd>C</kbd> cut
      </p>
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
        {ALSO_ON_GITHUB.length > 0 && (
          <>
            <p className="deck-list-sub mono">Also on GitHub</p>
            <ul>
              {ALSO_ON_GITHUB.map((r) => (
                <li key={r.name}>
                  <a href={r.url} target="_blank" rel="noreferrer">
                    <span className="deck-list-num mono" aria-hidden="true">
                      {r.year}
                    </span>
                    <span className="deck-list-title">
                      {r.name}
                      <span className="visually-hidden"> (on GitHub, opens in a new tab)</span>
                    </span>
                    <span className="deck-list-note">{r.note}</span>
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </details>
    </div>
  );
}
