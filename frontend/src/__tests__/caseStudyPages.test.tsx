import { describe, expect, it } from "vitest";
import { renderCaseStudies } from "../entry-server";
import { PROJECTS } from "../../../content/projects";
import { PROJECT_INDEX } from "../stats";

const pages = renderCaseStudies();
const doc = (html: string) => new DOMParser().parseFromString(html, "text/html");

describe("the case study pages", () => {
  it("writes one page per project, in page order", () => {
    expect(pages.map((p) => p.slug)).toEqual(PROJECT_INDEX.map((p) => p.slug));
  });

  it("carries the whole case study as text, with one h1, the title", () => {
    for (const page of pages) {
      const project = PROJECTS.find((p) => p.slug === page.slug)!;
      const d = doc(page.html);
      expect(d.querySelectorAll("h1")).toHaveLength(1);
      expect(d.querySelector("h1")?.textContent).toBe(project.title);
      const text = d.body.textContent ?? "";
      expect(text).toContain(project.subtitle);
      if (project.problem) expect(text, `${project.slug} problem`).toContain(project.problem);
      for (const o of project.outcomes ?? []) expect(text, `${project.slug} outcome`).toContain(o);
      for (const step of project.deliveryProcess ?? []) expect(text).toContain(step);
    }
  });

  it("links each page to its neighbours and back to the work", () => {
    const first = doc(pages[0].html);
    const nav = first.querySelector(".case-page-nav")!;
    const hrefs = Array.from(nav.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/#work-index", `/work/${pages[1].slug}/`]);
    const last = doc(pages[pages.length - 1].html);
    expect(last.querySelector(".case-page-nav a")?.getAttribute("href")).toBe(`/work/${pages[pages.length - 2].slug}/`);
  });

  it("loads no script: the page is complete as HTML", () => {
    for (const page of pages) expect(page.html).not.toContain("<script");
  });
});
