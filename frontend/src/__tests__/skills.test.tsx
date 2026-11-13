import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NUMBERING, Skills, evidenceProject, rowProject } from "../components/Skills";
import { peekDeal, takeDeal } from "../lib/dealRequest";
import { CATEGORIES, SKILLS, skillsIn } from "../skills";
import { PROJECT_INDEX, STATS, projectNumber } from "../stats";
import { Wrap } from "./motion/helpers";

const renderSkills = () =>
  render(
    <Wrap>
      <Skills />
    </Wrap>,
  );

// Evidence that is not a project on the page, shown as a note.
const NOTES = new Set(["Coursework", "Self-directed study", "Every project here", "Personal deployments"]);

describe("skills data", () => {
  it("no longer lists what left the site with the redesign", () => {
    const names = SKILLS.map((s) => s.name);
    expect(names).not.toContain("GSAP");
    expect(names).not.toContain("Lenis");
    expect(names).not.toContain("Canvas 2D");
  });

  it("resolves every evidence entry to a project, unless it is one of the notes", () => {
    for (const s of SKILLS) {
      if (NOTES.has(s.evidence)) expect(evidenceProject(s.evidence)).toBeUndefined();
      else expect(evidenceProject(s.evidence), `${s.name}: ${s.evidence}`).toBeDefined();
    }
  });

  it("maps the aliases to the right projects", () => {
    expect(evidenceProject("Exercise Prescription App")?.slug).toBe("exercise");
    expect(evidenceProject("This portfolio")?.slug).toBe("portfolio-v2");
    expect(evidenceProject("Donation Management System")?.slug).toBe("dms");
    expect(evidenceProject("Smart Grocery App")?.slug).toBe("smart-grocery");
  });

  it("covers every project in the index with a page address", () => {
    for (const p of PROJECT_INDEX) expect(p.slug).toMatch(/^[a-z0-9-]+$/);
  });
});

describe("Skills section", () => {
  it("is the #skills section, headed by its h2", () => {
    const { container } = renderSkills();
    const section = container.querySelector("section#skills")!;
    expect(section).not.toBeNull();
    expect(section).toHaveAttribute("aria-labelledby", "skills-heading");
    expect(screen.getByRole("heading", { level: 2, name: "Skills, and where I used them" })).toBeInTheDocument();
  });

  it("has the seven groups in category order, each with its count", () => {
    const { container } = renderSkills();
    const titles = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(titles).toEqual(CATEGORIES.map((c) => c.label));
    const counts = Array.from(container.querySelectorAll(".skills-count .odometer .visually-hidden")).map(
      (n) => n.textContent,
    );
    expect(counts).toEqual(CATEGORIES.map((c) => String(skillsIn(c.id).length)));
  });

  it("links each project number to the project, named for screen readers", () => {
    renderSkills();
    for (const c of CATEGORIES) {
      const list = screen.getByRole("list", { name: c.label });
      const rows = within(list).getAllByRole("listitem");
      expect(rows).toHaveLength(skillsIn(c.id).length);
      skillsIn(c.id).forEach((s, i) => {
        const row = rows[i];
        expect(row).toHaveTextContent(s.name);
        const p = evidenceProject(s.evidence);
        if (p) {
          const link = within(row).getByRole("link", { name: `${s.name}, used in project ${projectNumber(p.slug)}, ${p.title}` });
          expect(link).toHaveAttribute("href", `/work/${p.slug}/`);
          expect(link).toHaveTextContent(projectNumber(p.slug));
        } else {
          expect(within(row).queryByRole("link")).toBeNull();
          expect(row).toHaveTextContent(s.evidence.toLowerCase());
        }
      });
    }
  });

  it("states the number ranges from the data, padded like the project numbers", () => {
    const { container } = renderSkills();
    const lastCase = PROJECT_INDEX[STATS.caseStudies - 1];
    const firstOther = PROJECT_INDEX[STATS.caseStudies];
    const last = PROJECT_INDEX[STATS.projects - 1];
    expect(NUMBERING).toBe(
      `Numbers are the projects above: ${projectNumber(PROJECT_INDEX[0].slug)} to ${projectNumber(lastCase.slug)} ` +
        `the case studies, ${projectNumber(firstOther.slug)} to ${projectNumber(last.slug)} the other work.`,
    );
    expect(container.querySelector(".section-intro")).toHaveTextContent(NUMBERING);
  });

  it("shows no ratings or levels", () => {
    const { container } = renderSkills();
    expect(container.querySelector("meter, progress, [role='meter'], [role='progressbar']")).toBeNull();
    expect(container.textContent).not.toMatch(/\blevel\b|\/\s?5\b/i);
  });
});

describe("skill-to-project highlight", () => {
  it("lights every row that names the same project, and clears on leave", () => {
    const { container } = renderSkills();
    const groups = container.querySelector<HTMLElement>(".skills-groups")!;
    const row = container.querySelector<HTMLElement>(".skills-row[data-project]")!;
    const slug = row.dataset.project!;
    const expected = SKILLS.filter((s) => evidenceProject(s.evidence)?.slug === slug).length;

    fireEvent.pointerOver(row.querySelector(".skills-name")!);
    expect(groups).toHaveAttribute("data-hot", slug);
    const lit = container.querySelectorAll(".skills-row.is-related");
    expect(lit).toHaveLength(expected);
    for (const r of lit) expect((r as HTMLElement).dataset.project).toBe(slug);

    fireEvent.pointerLeave(groups);
    expect(groups).not.toHaveAttribute("data-hot");
    expect(container.querySelector(".skills-row.is-related")).toBeNull();
  });

  it("follows keyboard focus on a project number", () => {
    const { container } = renderSkills();
    const link = container.querySelector<HTMLAnchorElement>(".skills-number")!;
    fireEvent.focus(link);
    expect(container.querySelector(".skills-groups")).toHaveAttribute(
      "data-hot",
      link.closest<HTMLElement>("[data-project]")!.dataset.project!,
    );
  });

  it("reads no project outside a row tied to one", () => {
    expect(rowProject(null)).toBeNull();
    expect(rowProject(document.createElement("div"))).toBeNull();
  });
});

describe("a skill's number deals its project", () => {
  it("asks the deck for the card on a plain click, and scrolls to it", () => {
    const deck = document.createElement("section");
    deck.id = "work-index";
    deck.scrollIntoView = () => {};
    document.body.appendChild(deck);
    try {
      const { container } = renderSkills();
      const link = container.querySelector<HTMLAnchorElement>(".skills-number")!;
      const slug = link.closest<HTMLElement>("[data-project]")!.dataset.project!;
      const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
      link.dispatchEvent(click);
      expect(click.defaultPrevented).toBe(true);
      expect(peekDeal()).toBe(slug);
      takeDeal();
    } finally {
      deck.remove();
    }
  });

  it("leaves a modified click to the browser: the project's own page", () => {
    const { container } = renderSkills();
    const link = container.querySelector<HTMLAnchorElement>(".skills-number")!;
    const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ctrlKey: true });
    link.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);
    expect(peekDeal()).toBeNull();
  });
});
