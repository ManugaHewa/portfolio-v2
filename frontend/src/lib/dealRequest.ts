/**
 * Asks the deck (DeckTable.tsx) to deal a project, from a skill's project
 * number or the wheel's landing. The request waits until the deck is on
 * screen, so the visitor sees the card dealt.
 */
let pending: string | null = null;
const listeners = new Set<() => void>();

export function requestDeal(slug: string): void {
  pending = slug;
  for (const listener of listeners) listener();
}

/** Takes the waiting request; a second call returns null. */
export function takeDeal(): string | null {
  const slug = pending;
  pending = null;
  return slug;
}

export function peekDeal(): string | null {
  return pending;
}

export function onDealRequest(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The click fields followDeal reads. */
export interface DealClick {
  defaultPrevented: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  preventDefault(): void;
}

/** A plain left click nothing has handled yet (no modifier keys). */
export const isPlainClick = (e: Omit<DealClick, "preventDefault">) =>
  !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

/**
 * Plain click on a project link: scroll to the deck and deal the card
 * instead of navigating. Modified clicks and no-JS visits follow the link.
 */
export function followDeal(e: DealClick, slug: string): void {
  if (!isPlainClick(e)) return;
  const deck = document.getElementById("work-index");
  if (!deck) return;
  e.preventDefault();
  requestDeal(slug);
  deck.scrollIntoView({ block: "start" });
}
