import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ProjectCard } from "../components/ProjectCard";

const project = {
  slug: "dms",
  title: "Donation Management System",
  subtitle: "Centralized donation operations and reporting.",
  stack: ["Node.js", "Prisma", "React"],
  githubUrl: "https://github.com/example/dms",
  liveUrl: null,
};

describe("ProjectCard", () => {
  it("renders the title and calls onOpen when clicked", () => {
    const onOpen = vi.fn();
    render(<ProjectCard project={project} onOpen={onOpen} />);

    expect(screen.getByText("Donation Management System")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /open donation management system/i }));
    expect(onOpen).toHaveBeenCalledWith("dms");
  });
});
