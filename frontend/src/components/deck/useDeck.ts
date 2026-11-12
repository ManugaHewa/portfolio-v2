import { useCallback, useState } from "react";

/**
 * The deck's state: the order the cards are in and how many have been
 * drawn. Drawn cards come off the top in order; the last one drawn is the
 * one face up on the table. `deal` counts deals, so a reshuffled deck gets
 * fresh keys for its animations.
 */
export interface DeckState {
  order: number[];
  drawn: number;
  deal: number;
}

/**
 * The opening state, the same on the server and in the browser: the
 * projects in page order, with the first already turned over, so the
 * prerendered page shows a project rather than a face-down pile.
 */
export function initialDeck(size: number): DeckState {
  return { order: Array.from({ length: size }, (_, i) => i), drawn: Math.min(1, size), deal: 0 };
}

/** The next card off the top, or the same state when the deck is empty. */
export function drawCard(s: DeckState): DeckState {
  return s.drawn >= s.order.length ? s : { ...s, drawn: s.drawn + 1 };
}

/**
 * Every card back in the deck, shuffled (Fisher-Yates; `random` is the
 * source, Math.random in the browser), and the new top card turned over.
 * Only ever called from a click, never while rendering, so the server and
 * the first render agree.
 */
export function shuffleDeck(s: DeckState, random: () => number = Math.random): DeckState {
  const order = [...s.order];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { order, drawn: Math.min(1, order.length), deal: s.deal + 1 };
}

/** The face-up card and the ones under it, most recent first, as indices into the projects. */
export function tableCards(s: DeckState, keep = 4): number[] {
  return s.order.slice(Math.max(0, s.drawn - keep), s.drawn).reverse();
}

/**
 * Whether a released drag threw the top card off the deck: far enough, or
 * fast enough, in any direction.
 */
export function thrown(offset: { x: number; y: number }, velocity: { x: number; y: number }): boolean {
  return Math.hypot(offset.x, offset.y) > 90 || Math.hypot(velocity.x, velocity.y) > 650;
}

export interface Deck extends DeckState {
  size: number;
  remaining: number;
  /** Index into the projects of the card face up on the table, or null before any draw. */
  current: number | null;
  draw(): void;
  shuffle(): void;
}

export function useDeck(size: number): Deck {
  const [state, setState] = useState(() => initialDeck(size));
  const draw = useCallback(() => setState(drawCard), []);
  const shuffle = useCallback(() => setState((s) => shuffleDeck(s)), []);
  return {
    ...state,
    size,
    remaining: state.order.length - state.drawn,
    current: state.drawn > 0 ? state.order[state.drawn - 1] : null,
    draw,
    shuffle,
  };
}
