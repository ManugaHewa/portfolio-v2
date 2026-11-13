import { useEffect } from "react";
import { morphId } from "../motion/morph";

/** The view-transition name the case study page's title carries (legal.css). */
export const CASE_TITLE = "case-page-title";

/**
 * What should travel to a project's page when the visitor follows a link
 * there: the case study's figure if its dialog is open, the project's card
 * if it is the one face up in the deck, or else the link itself.
 */
export function transitionSource(link: HTMLAnchorElement, slug: string): HTMLElement {
  const dialogFigure = document.querySelector<HTMLElement>("[role=dialog] .dialog-figure");
  if (dialogFigure) return dialogFigure;
  const card = document.querySelector<HTMLElement>(`.pcard.is-up[id="${morphId(slug)}"] .pcard-face`);
  return card ?? link;
}

/**
 * Following a link to a project's own page (/work/<slug>/) on the home
 * page: the cross-document view transition (base.css) carries the card, or
 * the dialog's figure, or the link, into the page's title as the page
 * changes, rather than only wiping from one page to the next.
 *
 * The element is named on the click, just before the browser takes its
 * snapshot of the old page, and only one element ever holds the name.
 * Browsers without cross-document view transitions simply navigate, and
 * under reduced motion there is no transition (base.css), so the name does
 * nothing. A click that does not navigate here (a modified click, or one a
 * handler has already taken, like a skill's number dealing its card) is
 * left alone.
 */
export function useCaseTransition(): void {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.<HTMLAnchorElement>("a[href^='/work/']");
      const slug = link?.getAttribute("href")?.match(/^\/work\/([a-z0-9-]+)\/?$/)?.[1];
      if (!link || !slug || link.target === "_blank") return;
      document.querySelectorAll<HTMLElement>("[data-case-transition]").forEach((el) => {
        el.style.removeProperty("view-transition-name");
        el.removeAttribute("data-case-transition");
      });
      const source = transitionSource(link, slug);
      source.style.setProperty("view-transition-name", CASE_TITLE);
      source.setAttribute("data-case-transition", "");
    };
    // Bubbling, so a handler that takes the click first (preventDefault)
    // has had its say.
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
}
