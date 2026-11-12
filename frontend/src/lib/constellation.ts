/**
 * Which project the page is pointing at, for the starfield: while a skill
 * row or a case card is hovered or focused, the sky draws a constellation
 * with one star for each technology that project used.
 *
 * A plain value the scene reads in its render loop, not React state: the
 * page sets it on pointer and focus events, and nothing re-renders.
 */
export interface Constellation {
  /** The project's slug: the same project always draws the same shape. */
  key: string;
  /** How many stars: one per technology in the project's stack. */
  count: number;
}

let current: Constellation | null = null;

export function showConstellation(key: string, count: number): void {
  current = { key, count };
}

/** Clears it, but only if it is still `key`'s: a later hover keeps its own. */
export function hideConstellation(key?: string): void {
  if (!key || current?.key === key) current = null;
}

export function readConstellation(): Constellation | null {
  return current;
}

/** A small stable hash, so a project's constellation has the same shape on every visit. */
export function hashKey(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
