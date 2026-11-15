/**
 * Spin button to wheel (rouletteScene.ts) and back. The button posts a
 * numbered ask that the scene reads in its render loop; the wheel answers
 * with the number the ball rests on.
 */
export interface SpinAsk {
  id: number;
  /** Highest number the ball may land on (the deck's last card). */
  top: number;
}

export interface SpinAnswer {
  id: number;
  number: number;
}

let seq = 0;
let latest: SpinAsk | null = null;
const listeners = new Set<(answer: SpinAnswer) => void>();

/** Asks for a spin landing on 0..top. Returns the ask's id. */
export function askSpin(top: number): number {
  seq += 1;
  latest = { id: seq, top };
  return seq;
}

export function readSpin(): SpinAsk | null {
  return latest;
}

/** Reports where the ball came to rest for ask `id`. */
export function answerSpin(answer: SpinAnswer): void {
  for (const listener of listeners) listener(answer);
}

export function onSpinAnswer(listener: (answer: SpinAnswer) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
