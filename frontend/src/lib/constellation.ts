/**
 * The project the page points at, for the starfield: while a skill row or
 * case card is hovered or focused, the sky draws one star per technology.
 * A plain value read in the render loop, so nothing re-renders.
 */
export interface Constellation {
  /** Project slug; the same slug always draws the same shape. */
  key: string;
  /** Star count: one per technology. */
  count: number;
}

let current: Constellation | null = null;

export function showConstellation(key: string, count: number): void {
  current = { key, count };
}

/** Clears it only if `key` still owns it, so a later hover keeps its own. */
export function hideConstellation(key?: string): void {
  if (!key || current?.key === key) current = null;
}

export function readConstellation(): Constellation | null {
  return current;
}

/** FNV-1a, so a project's shape is the same on every visit. */
export function hashKey(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
