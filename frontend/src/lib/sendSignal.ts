/**
 * Contact form to contact scene: a numbered latest event the scene reads in
 * its render loop and acts on once per number. Nothing re-renders, and a
 * paused or off-screen scene never replays a stale send.
 */
export type SendEvent = { kind: "launch" } | { kind: "land"; ok: boolean; code: number | null };

let seq = 0;
let latest: { seq: number; event: SendEvent } | null = null;

export function signalSend(event: SendEvent): void {
  seq += 1;
  latest = { seq, event };
}

export function readSend(): { seq: number; event: SendEvent } | null {
  return latest;
}
