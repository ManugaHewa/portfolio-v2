/**
 * The contact form telling the contact section's scene what its message is
 * doing, so the scene can show it: a packet launched when the visitor
 * presses send, landing on the plane with the server's real answer.
 *
 * A numbered latest event rather than a subscription: the scene reads it in
 * its own render loop and acts once per new number, so nothing re-renders
 * and a scene that is paused or off screen simply never shows a stale send.
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
