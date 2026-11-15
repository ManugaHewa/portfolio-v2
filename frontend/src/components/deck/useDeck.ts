import { useCallback, useEffect, useRef, useState } from "react";
import { clamp } from "../../lib/math";

/**
 * Deck state. Cards come off the top of `order`; the last drawn is face up.
 * `deal` counts shuffles, so a reshuffle gets fresh animation keys.
 */
export interface DeckState {
  order: number[];
  drawn: number;
  deal: number;
  spread: boolean;
  riffling: boolean;
  /** Cards lifted for a cut in progress, or 0. */
  cutting: number;
  /** Cut count, and where the last cut was made (`deal:drawn`), so it is announced once. */
  cuts: number;
  cutMark: string;
}

/** Riffle time before the new top card is dealt (ms). */
export const RIFFLE_MS = 1050;
/** Time a cut's top packet is held aside (ms). */
export const CUT_MS = 420;

/** Opening state, same on server and client: page order, first card face up. */
/** Where in the game a cut was made, so it is announced once. */
export const cutMarkOf = (s: Pick<DeckState, "deal" | "drawn">) => `${s.deal}:${s.drawn}`;

export function initialDeck(size: number): DeckState {
  return {
    order: Array.from({ length: size }, (_, i) => i),
    drawn: Math.min(1, size),
    deal: 0,
    spread: false,
    riffling: false,
    cutting: 0,
    cuts: 0,
    cutMark: "",
  };
}

/** Draws the top card; unchanged when empty or riffling. */
export function drawCard(s: DeckState): DeckState {
  if (s.riffling || s.drawn >= s.order.length) return s;
  return { ...s, drawn: s.drawn + 1, spread: false };
}

/** Puts one project face up: dealt from the deck, or raised to the top of the table. */
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
 * All cards back, Fisher-Yates shuffled, none dealt; useDeck deals the top
 * card after the riffle. Called only from clicks, so hydration matches.
 */
export function shuffleDeck(s: DeckState, random: () => number = Math.random): DeckState {
  const order = [...s.order];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { ...s, order, drawn: 0, deal: s.deal + 1, spread: false, riffling: true, cutting: 0 };
}

/**
 * Moves the top `k` undrawn cards to the bottom. An empty packet or a cut
 * while riffling changes nothing (except ending a cut in progress).
 */
export function cutDeck(s: DeckState, k: number): DeckState {
  const left = s.order.length - s.drawn;
  if (s.riffling || k < 1 || k >= left) return s.cutting ? { ...s, cutting: 0 } : s;
  const rest = s.order.slice(s.drawn);
  return {
    ...s,
    order: [...s.order.slice(0, s.drawn), ...rest.slice(k), ...rest.slice(0, k)],
    spread: false,
    cutting: 0,
    cuts: s.cuts + 1,
    cutMark: cutMarkOf(s),
  };
}

/** Cut depth near the middle, give or take two; 0 when nothing can be cut. */
export function cutDepth(remaining: number, random: () => number = Math.random): number {
  if (remaining < 2) return 0;
  const k = Math.round(remaining / 2 + (random() - 0.5) * Math.min(4, remaining - 2));
  return clamp(k, 1, remaining - 1);
}

/** Face-up card and those under it, newest first (project indices). */
export function tableCards(s: DeckState, keep = 4): number[] {
  return s.order.slice(Math.max(0, s.drawn - keep), s.drawn).reverse();
}

/** The cards still in the deck, top first. */
export function deckCards(s: DeckState): number[] {
  return s.order.slice(s.drawn);
}

/** Whether a released drag threw the top card: far or fast enough, any direction. */
export function thrown(offset: { x: number; y: number }, velocity: { x: number; y: number }): boolean {
  return Math.hypot(offset.x, offset.y) > 90 || Math.hypot(velocity.x, velocity.y) > 650;
}

export interface Deck extends DeckState {
  size: number;
  remaining: number;
  /** Project index of the face-up card, or null. */
  current: number | null;
  draw(): void;
  pull(index: number): void;
  shuffle(): void;
  setSpread(spread: boolean): void;
  /** Cuts near the middle: the packet is held aside, then goes under (CUT_MS). */
  cut(): void;
  /** Cuts `k` cards at once (a hand cut, packet already aside). */
  cutAt(k: number): void;
}

/** The live deck. `instant` (reduced motion or paused) skips the riffle and cut delays. */
export function useDeck(size: number, instant: boolean): Deck {
  const [state, setState] = useState(() => initialDeck(size));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (cutTimer.current) clearTimeout(cutTimer.current);
    },
    [],
  );

  // A list arriving after the first render (dev, or a retried load) gets a fresh deck.
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
    // Riffle, then deal the new top card.
    timer.current = setTimeout(
      () => setState((s) => ({ ...s, riffling: false, drawn: Math.max(s.drawn, Math.min(1, s.order.length)) })),
      instant ? 0 : RIFFLE_MS,
    );
  }, [instant]);

  const left = state.order.length - state.drawn;
  const busy = state.riffling || state.cutting > 0;
  const cutAt = useCallback((k: number) => setState((s) => cutDeck(s, k)), []);
  const cut = useCallback(() => {
    const k = cutDepth(left);
    if (busy || k < 1) return;
    if (instant) {
      cutAt(k);
      return;
    }
    setState((s) => (s.riffling || s.cutting ? s : { ...s, cutting: k, spread: false }));
    if (cutTimer.current) clearTimeout(cutTimer.current);
    cutTimer.current = setTimeout(() => setState((s) => cutDeck(s, s.cutting)), CUT_MS);
  }, [busy, cutAt, instant, left]);

  return {
    ...state,
    size,
    remaining: left,
    current: state.drawn > 0 ? state.order[state.drawn - 1] : null,
    draw,
    pull,
    shuffle,
    setSpread,
    cut,
    cutAt,
  };
}
