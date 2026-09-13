import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ProjectCard } from "../components/ProjectCard";

const project = {
  slug: "dms",
  title: "Donation Management System",
  subtitle: "Centralized donation operations and reporting.",
  stack: ["Node.js", "Prisma", "React"],
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
});
