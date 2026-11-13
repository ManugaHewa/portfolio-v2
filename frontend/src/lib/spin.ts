/**
 * The hero's Spin button and its wheel (rouletteScene.ts) talking.
 *
 * The button asks: a numbered latest ask, which the scene reads in its own
 * render loop and acts on once per new number, as the contact form's send
 * signal works (lib/sendSignal.ts). A scene that is paused, off screen or
 * not built yet simply has not seen it. The wheel answers once the ball has
 * come to rest: the number it landed on, for the ask it answers.
 */
export interface SpinAsk {
  id: number;
  /** The highest number the ball may land on: the deck's last card. */
  top: number;
}

export interface SpinAnswer {
  id: number;
  number: number;
}

let seq = 0;
let latest: SpinAsk | null = null;
const listeners = new Set<(answer: SpinAnswer) => void>();

/** Asks the wheel for a spin landing on 0 to `top`; returns the ask's number. */
export function askSpin(top: number): number {
  seq += 1;
  latest = { id: seq, top };
  return seq;
}

export function readSpin(): SpinAsk | null {
  return latest;
}

/** The wheel's answer: where the ball came to rest for ask `id`. */
export function answerSpin(answer: SpinAnswer): void {
  for (const listener of listeners) listener(answer);
}

export function onSpinAnswer(listener: (answer: SpinAnswer) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
