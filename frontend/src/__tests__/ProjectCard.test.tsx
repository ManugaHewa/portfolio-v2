import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ProjectCard } from "../components/ProjectCard";

import type { ProjectSummary } from "../types";

const project: ProjectSummary = {
  slug: "dms",
  title: "Donation Management System",
  subtitle: "Centralized donation operations and reporting.",
  stack: ["Node.js", "Prisma", "React"],
  role: "Full-stack engineer, end to end",
  timeline: "Multi-sprint build",
  category: "Full-stack web",
  status: "In active development",
  tier: 1,
  outcomes: [
    "Around thirty percent faster release cycles.",
    "Automated acknowledgements within twenty-four hours.",
  ],
  links: [{ label: "GitHub repository", url: "https://github.com/example/dms" }],
};

describe("ProjectCard", () => {
  it("renders the title and calls onOpen when clicked", () => {
    const onOpen = vi.fn();
    render(<ProjectCard project={project} onOpen={onOpen} />);

    expect(screen.getByText("Donation Management System")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /open donation management system/i }));
    expect(onOpen).toHaveBeenCalledWith("dms");
  });

  it("shows the stack as individual chips", () => {
    render(<ProjectCard project={project} onOpen={vi.fn()} />);
    for (const tag of project.stack) {
      expect(screen.getByText(tag)).toBeInTheDocument();
    }
  });

  it("caps the chips at six and counts the remainder", () => {
    const wide = {
      ...project,
      stack: ["TypeScript", "Node.js", "Express", "Prisma", "PostgreSQL", "React", "Docker", "RBAC"],
    };
    render(<ProjectCard project={wide} onOpen={vi.fn()} />);

    expect(screen.getByText("React")).toBeInTheDocument();
    // Seventh and eighth collapse into a count so the card cannot grow a
    // second row of chips and push the grid out of alignment.
    expect(screen.queryByText("Docker")).not.toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("surfaces the role and the headline outcome on the card itself", () => {
    // These used to be reachable only by opening the modal. A reader
    // scanning the grid is looking for exactly these two things.
    render(<ProjectCard project={project} onOpen={vi.fn()} />);

    expect(screen.getByText("Full-stack engineer, end to end")).toBeInTheDocument();
    expect(screen.getByText(project.outcomes[0])).toBeInTheDocument();
    // Only the first outcome belongs on the card; the rest stay in the modal.
    expect(screen.queryByText(project.outcomes[1])).not.toBeInTheDocument();
  });

  it("shows the category and status as pills", () => {
    render(<ProjectCard project={project} onOpen={vi.fn()} />);

    expect(screen.getByText("Full-stack web")).toBeInTheDocument();
    // Work still moving is marked apart from work that is finished, which is
    // what the pill colour keys off.
    expect(screen.getByText("In active development")).toHaveAttribute("data-ongoing", "true");
  });

  it("renders without a role, category, status or outcomes", () => {
    const sparse: ProjectSummary = {
      ...project,
      role: null,
      timeline: null,
      category: null,
      status: null,
      outcomes: [],
    };
    render(<ProjectCard project={sparse} onOpen={vi.fn()} />);

    expect(screen.getByText("Donation Management System")).toBeInTheDocument();
    expect(screen.queryByText(/^outcome$/i)).not.toBeInTheDocument();
  });

  it("renders a link with no url as a label rather than an anchor", () => {
    // The source list marks some links "[add link]": planned, and without an
    // address. An <a href=""> would reload the page, and a fake URL would be
    // worse than either.
    const pending: ProjectSummary = {
      ...project,
      links: [
        { label: "GitHub repository", url: "https://github.com/example/dms" },
        { label: "Demo video", url: "" },
      ],
    };
    render(<ProjectCard project={pending} onOpen={vi.fn()} />);

    expect(screen.getByRole("link", { name: /github repository/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /demo video/i })).not.toBeInTheDocument();
    expect(screen.getByText(/demo video/i)).toBeInTheDocument();
  });

  it("still opens the modal from a compact row", () => {
    const onOpen = vi.fn();
    render(<ProjectCard project={project} onOpen={onOpen} variant="compact" />);

    // A row carries the title, the tagline and the category, and nothing that
    // would give it the weight of a case-study card.
    expect(screen.getByText("Donation Management System")).toBeInTheDocument();
    expect(screen.getByText("Full-stack web")).toBeInTheDocument();
    expect(screen.queryByText(/read the case study/i)).not.toBeInTheDocument();
    expect(screen.queryByText(project.outcomes[0])).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /open donation management system/i }));
    expect(onOpen).toHaveBeenCalledWith("dms");
  });
});
