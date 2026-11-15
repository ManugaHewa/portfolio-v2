import { useSyncExternalStore } from "react";

/** This visit's GET /api/projects timing, measured in api.ts. */
export type ProjectsTiming = { ok: true; ms: number; count: number } | { ok: false };

let current: ProjectsTiming | null = null;
const listeners = new Set<() => void>();

/** Set by api.ts when the request settles. */
export function recordProjectsTiming(timing: ProjectsTiming): void {
  current = timing;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The timing, live. Null on the server, while hydrating and until the request settles. */
export function useProjectsTiming(): ProjectsTiming | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}

/** Test helper: forgets the last timing. */
export function resetProjectsTiming(): void {
  current = null;
}
