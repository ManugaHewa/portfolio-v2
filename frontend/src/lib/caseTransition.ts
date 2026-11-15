import { useEffect } from "react";
import { morphId } from "../motion/morph";
import { isPlainClick } from "./dealRequest";

/** View-transition name of the case study page title (legal.css). */
export const CASE_TITLE = "case-page-title";

/** What morphs into the project page: the open dialog's figure, the face-up card, or the link. */
export function transitionSource(link: HTMLAnchorElement, slug: string): HTMLElement {
  const dialogFigure = document.querySelector<HTMLElement>("[role=dialog] .dialog-figure");
  if (dialogFigure) return dialogFigure;
  const card = document.querySelector<HTMLElement>(`.pcard.is-up[id="${morphId(slug)}"] .pcard-face`);
  return card ?? link;
}

/**
 * On a link to /work/<slug>/, names the element that morphs into the page
 * title in the cross-document view transition (base.css). Named on click,
 * just before the browser snapshots the page; one element at a time.
 * Modified or already-handled clicks are ignored.
 */
export function useCaseTransition(): void {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!isPlainClick(e)) return;
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
    // Bubble phase: handlers that preventDefault run first.
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
}
