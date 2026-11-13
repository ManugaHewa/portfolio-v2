import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The deck's state: the order the cards are in, how many have been drawn,
 * which deal this is, and whether the deck is spread out on the table or
 * being riffled. Drawn cards come off the top in order; the last one drawn
 * is the one face up. `deal` counts shuffles, so a reshuffled deck gets
 * fresh keys for its animations.
 */
export interface DeckState {
  order: number[];
  drawn: number;
  deal: number;
  spread: boolean;
  riffling: boolean;
}

/** How long the riffle takes before the new top card is dealt (ms). */
export const RIFFLE_MS = 1050;

/**
 * The opening state, the same on the server and in the browser: the
 * projects in page order, with the first already turned over, so the
 * prerendered page shows a project rather than a face-down pile.
 */
export function initialDeck(size: number): DeckState {
  return {
    order: Array.from({ length: size }, (_, i) => i),
    drawn: Math.min(1, size),
    deal: 0,
    spread: false,
    riffling: false,
  };
}

/** The next card off the top, or the same state when the deck is empty or busy. */
export function drawCard(s: DeckState): DeckState {
  if (s.riffling || s.drawn >= s.order.length) return s;
  return { ...s, drawn: s.drawn + 1, spread: false };
}

/**
 * One particular project, face up: taken from wherever it is in the deck
 * and dealt, or, if it is already on the table, brought to the top of the
 * cards there. Picking a card from the spread and a skill's number both
 * use this.
 */
export function pullCard(s: DeckState, index: number): DeckState {
  const at = s.order.indexOf(index);
  if (at < 0 || s.riffling) return s;
  if (at === s.drawn - 1) return { ...s, spread: false };
  const order = s.order.filter((i) => i !== index);
  if (at < s.drawn) {
    order.splice(s.drawn - 1, 0, index);
    return { ...s, order, spread: false };
  }
  order.splice(s.drawn, 0, index);
  return { ...s, order, drawn: s.drawn + 1, spread: false };
}

/**
 * Every card back in the deck, shuffled (Fisher-Yates; `random` is the
 * source, Math.random in the browser), with nothing dealt yet: the deck is
 * riffled first and the top card dealt after (useDeck). Only ever called
 * from a click, never while rendering, so the server and the first render
 * agree.
 */
export function shuffleDeck(s: DeckState, random: () => number = Math.random): DeckState {
  const order = [...s.order];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { order, drawn: 0, deal: s.deal + 1, spread: false, riffling: true };
}

/** The face-up card and the ones under it, most recent first, as indices into the projects. */
export function tableCards(s: DeckState, keep = 4): number[] {
  return s.order.slice(Math.max(0, s.drawn - keep), s.drawn).reverse();
}

/** The cards still in the deck, top first. */
export function deckCards(s: DeckState): number[] {
  return s.order.slice(s.drawn);
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
  pull(index: number): void;
  shuffle(): void;
  setSpread(spread: boolean): void;
}

/**
 * The deck, live. `instant` (reduced motion, or motion paused) skips the
 * riffle: a shuffle deals its top card straight away.
 */
export function useDeck(size: number, instant: boolean): Deck {
  const [state, setState] = useState(() => initialDeck(size));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // A list that arrives after the first render (development, where nothing
  // is prerendered, or a failed load retried) deals a fresh deck for it.
  useEffect(() => {
    setState((s) => (s.order.length === size ? s : initialDeck(size)));
  }, [size]);

  const draw = useCallback(() => setState(drawCard), []);
  const pull = useCallback((index: number) => setState((s) => pullCard(s, index)), []);
  const setSpread = useCallback(
    (spread: boolean) => setState((s) => (s.riffling || s.spread === spread ? s : { ...s, spread })),
    [],
  );
  const shuffle = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setState((s) => (s.riffling ? s : shuffleDeck(s)));
    // The riffle runs, then the new top card is dealt.
    timer.current = setTimeout(
      () => setState((s) => ({ ...s, riffling: false, drawn: Math.max(s.drawn, Math.min(1, s.order.length)) })),
      instant ? 0 : RIFFLE_MS,
    );
  }, [instant]);

  return {
    ...state,
    size,
    remaining: state.order.length - state.drawn,
    current: state.drawn > 0 ? state.order[state.drawn - 1] : null,
    draw,
    pull,
    shuffle,
    setSpread,
  };
}
