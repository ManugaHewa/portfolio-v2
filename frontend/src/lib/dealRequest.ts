/**
 * A project asked for from elsewhere on the page, for the deck to deal: a
 * skill's project number, followed, or the number the hero's wheel landed
 * on, scrolls to the deck and the deck turns that project's card face up
 * (DeckTable.tsx), rather than jumping to a section that repeats the same
 * projects.
 *
 * The latest request waits here until the deck is on screen to show it,
 * then the deck takes it (and clears it), so the visitor sees the card come
 * off the deck rather than arriving after it has already landed.
 */
let pending: string | null = null;
const listeners = new Set<() => void>();

export function requestDeal(slug: string): void {
  pending = slug;
  for (const listener of listeners) listener();
}

/** The waiting request, taken: a second call returns null. */
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

/** The parts of a click followDeal reads. */
export interface DealClick {
  defaultPrevented: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  preventDefault(): void;
}

/**
 * A link to a project's page, followed with a plain click: the page scrolls
 * to the deck instead, and the deck deals that project's card. A new tab, a
 * middle click or a visitor without JavaScript get the link's own page.
 */
export function followDeal(e: DealClick, slug: string): void {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const deck = document.getElementById("work-index");
  if (!deck) return;
  e.preventDefault();
  requestDeal(slug);
  deck.scrollIntoView({ block: "start" });
}
