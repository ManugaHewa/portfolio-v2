import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkIndex } from "../components/WorkIndex";
import { STATS, projectNumber } from "../stats";
import { projectSummaries } from "../../../content/projects";
import type { ProjectSummary } from "../types";
import { Wrap } from "./motion/helpers";

const cases = projectSummaries().filter((p) => p.tier === 1) as ProjectSummary[];

const renderIndex = () =>
  render(
    <Wrap>
      <WorkIndex cases={cases} />
    </Wrap>,
  );

describe("WorkIndex", () => {
  it("is the #work-index section, headed 'Selected work'", () => {
    const { container } = renderIndex();
    const section = container.querySelector("section#work-index")!;
    expect(section).not.toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Selected work" })).toBeInTheDocument();
    expect(section).toHaveAttribute("aria-labelledby", "work-index-heading");
  });

  it("reads its three counts from the data", () => {
    const { container } = renderIndex();
    const readout = container.querySelector(".work-index-readout")!;
    const sr = Array.from(readout.querySelectorAll(".odometer .visually-hidden")).map((n) => n.textContent);
    expect(sr).toEqual([String(STATS.projects), String(STATS.caseStudies), String(STATS.repositories)]);
    expect(readout).toHaveTextContent("projects on this page");
    expect(readout).toHaveTextContent("case studies");
    expect(readout).toHaveTextContent("repositories");
  });

  it("has one row per case study, in order, each a single link to its card", () => {
    renderIndex();
    const list = screen.getByRole("list");
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(cases.length);
    rows.forEach((row, i) => {
      const links = within(row).getAllByRole("link");
      expect(links).toHaveLength(1);
      expect(links[0]).toHaveAttribute("href", `#case-${cases[i].slug}`);
    });
  });

  it("names each row by its visible text, title first", () => {
    renderIndex();
    for (const p of cases) {
      const meta = [p.category, p.status].filter(Boolean).join(" · ");
      const name = [p.title, meta, p.problem].filter(Boolean).join(" ");
      const link = screen.getByRole("link", { name });
      // No aria-labelledby or aria-label: every visible word is in the name
      // (WCAG 2.5.3), and the decorative number is not.
      expect(link).not.toHaveAttribute("aria-labelledby");
      expect(link).not.toHaveAttribute("aria-label");
      expect(link.textContent).toContain(projectNumber(p.slug));
      expect(link).not.toHaveAccessibleName(new RegExp(`^${projectNumber(p.slug)}`));
    }
  });

  it("numbers the rows with projectNumber", () => {
    const { container } = renderIndex();
    const numbers = Array.from(container.querySelectorAll(".work-index-num")).map((n) => n.textContent);
    expect(numbers).toEqual(cases.map((p) => projectNumber(p.slug)));
    expect(numbers).toEqual(["01", "02", "03", "04", "05", "06"]);
  });

  it("marks the rows as entrances, so no-JS and reduced motion show them", () => {
    const { container } = renderIndex();
    const items = container.querySelectorAll(".work-index-item");
    items.forEach((li) => expect(li).toHaveAttribute("data-reveal"));
  });
});
