import { useSyncExternalStore } from "react";

/** This visit's GET /api/projects, as measured by the api client. */
export type ProjectsTiming = { ok: true; ms: number; count: number } | { ok: false };

let current: ProjectsTiming | null = null;
const listeners = new Set<() => void>();

/** Called by api.ts once the request has answered or failed. */
export function recordProjectsTiming(timing: ProjectsTiming): void {
  current = timing;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * The measurement, live. Null on the server and while hydrating (the
 * prerendered page cannot know how this visit's request went, so it shows a
 * placeholder), and until the request has finished.
 */
export function useProjectsTiming(): ProjectsTiming | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}

/** For tests: forget the last measurement. */
export function resetProjectsTiming(): void {
  current = null;
}
