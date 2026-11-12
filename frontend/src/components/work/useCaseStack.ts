import { useEffect } from "react";
import type { RefObject } from "react";
import { morphId } from "../../motion";

/** How far down each later card sticks, in px: the edges of the deck. */
export const STACK_STEP = 14;
/** The header plus the breathing room under it, in px (work.css matches). */
const STACK_TOP = 64 + 24;
/** How much a card shrinks once the next one covers it. */
const SHRINK = 0.05;

/** Where card `i` sticks, in px from the top of the viewport. */
export const stickTop = (i: number) => STACK_TOP + i * STACK_STEP;

/**
 * How far the next card has slid over card `i`: 0 while it is still below
 * card i's bottom edge, 1 once it has reached its own resting place.
 */
export function coverage(myTop: number, height: number, nextTop: number): number {
  const span = Math.max(1, height - STACK_STEP);
  return Math.min(1, Math.max(0, (myTop + height - nextTop) / span));
}

/**
 * The stacked case studies (work.css, on the pinned-layout query): every card
 * sticks a little lower than the one before, so as the visitor scrolls each
 * one slides up over the last like a dealt deck.
 *
 * This adds what CSS cannot do alone:
 * - the covered card shrinks a little and darkens as the next one slides
 *   over it (a transform and a CSS variable written straight to the card,
 *   once per frame);
 * - getting to a card puts it on top. Sticky cards are measured where they
 *   are stuck, so the browser's own jump to #case-<slug> (a work index row,
 *   a skill's number) or to a focused control could land on a card buried
 *   in the deck. The scroll is corrected to where the card first sticks,
 *   with nothing over it: after a link to a case card is followed, on
 *   hashchange, and when keyboard focus moves into a card that is covered.
 *
 * The cards share one height, so where card i first sticks is simply the
 * grid's top plus i card-and-gap steps.
 */
export function useCaseStack(gridRef: RefObject<HTMLElement>, enabled: boolean): void {
  useEffect(() => {
    const grid = gridRef.current;
    if (!enabled || !grid) return;
    const cells = () => Array.from(grid.querySelectorAll<HTMLElement>(":scope > .case-cell"));
    let frame = 0;

    const paint = () => {
      frame = 0;
      const list = cells();
      list.forEach((cell, i) => {
        const card = cell.querySelector<HTMLElement>(".case-card");
        const next = list[i + 1];
        if (!card) return;
        const p = next
          ? coverage(cell.getBoundingClientRect().top, cell.offsetHeight, next.getBoundingClientRect().top)
          : 0;
        card.style.transform = p > 0 ? `scale(${(1 - SHRINK * p).toFixed(4)})` : "";
        card.style.setProperty("--cover", p.toFixed(3));
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };

    /** The scroll position at which card i first sticks, uncovered. */
    const restingScroll = (i: number) => {
      const list = cells();
      const first = list[0];
      if (!first) return null;
      const gap = parseFloat(getComputedStyle(grid).rowGap) || 0;
      const gridTop = grid.getBoundingClientRect().top + window.scrollY;
      return gridTop + i * (first.offsetHeight + gap) - stickTop(i);
    };

    const bringToTop = (cell: Element | null) => {
      const i = cells().indexOf(cell as HTMLElement);
      const y = i < 0 ? null : restingScroll(i);
      if (y !== null) window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
    };

    const fromHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id.startsWith(morphId(""))) return;
      const card = document.getElementById(id);
      if (card && grid.contains(card)) bringToTop(card.closest(".case-cell"));
    };

    // After the browser has followed the link, so this has the last word.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href^='#']");
      if (a && a.getAttribute("href")?.startsWith(`#${morphId("")}`)) requestAnimationFrame(fromHash);
    };

    const onFocusIn = (e: FocusEvent) => {
      const cell = (e.target as Element).closest(".case-cell");
      const list = cells();
      const i = list.indexOf(cell as HTMLElement);
      if (i < 0) return;
      const next = list[i + 1];
      const r = (e.target as Element).getBoundingClientRect();
      const covered = next !== undefined && next.getBoundingClientRect().top < r.bottom;
      const above = cell!.getBoundingClientRect().top < stickTop(i) - 1;
      if (covered || above) bringToTop(cell);
    };

    paint();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("hashchange", fromHash);
    document.addEventListener("click", onClick);
    grid.addEventListener("focusin", onFocusIn);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("hashchange", fromHash);
      document.removeEventListener("click", onClick);
      grid.removeEventListener("focusin", onFocusIn);
      for (const cell of cells()) {
        const card = cell.querySelector<HTMLElement>(".case-card");
        card?.style.removeProperty("transform");
        card?.style.removeProperty("--cover");
      }
    };
  }, [gridRef, enabled]);
}
