import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { ProjectModal } from "../components/ProjectModal";
import type { ProjectDetail } from "../types";

const project: ProjectDetail = {
  slug: "dms",
  title: "Donation Management System",
  subtitle: "Centralized donation operations.",
  stack: ["Node.js", "Prisma"],
  links: [{ label: "GitHub repository", url: "https://github.com/example/dms" }],
  role: "Full-stack engineer",
  timeline: "Multi-sprint",
  category: "Full-stack web",
  status: "In active development",
  tier: 1,
  context: "Built for a working organisation.",
  problem: "Tracking was fragmented across channels.",
  scope: ["Donor records", "Validation workflow"],
  stakeholders: ["Treasurers"],
  requirements: ["Audit logs"],
  nonFunctional: ["WCAG 2.1"],
  deliveryProcess: ["Schema first"],
  risks: ["Duplicate records on re-import"],
  challenges: ["requireAdmin resolved to undefined on an import mismatch"],
  outcomes: ["Faster release cycles"],
  highlights: [],
  nextSteps: [],
  learned: "Prisma migrations and schema design against a real system.",
};

/** Mounts the modal behind a trigger, so focus return can be observed. */
function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open project</button>
      <ProjectModal project={open ? project : null} onClose={() => setOpen(false)} />
    </>
  );
}

describe("ProjectModal", () => {
  it("renders only the sections that have content", () => {
    render(<ProjectModal project={project} onClose={vi.fn()} />);

    expect(screen.getByText("Scope")).toBeInTheDocument();
    expect(screen.getByText("Outcomes")).toBeInTheDocument();
    expect(screen.getByText("Technical challenges")).toBeInTheDocument();
    expect(screen.getByText("What I learned")).toBeInTheDocument();
    // highlights and nextSteps are empty, so their headings must not appear.
    expect(screen.queryByText("Highlights")).not.toBeInTheDocument();
    expect(screen.queryByText("Next steps")).not.toBeInTheDocument();
  });

  it("lists the category and status alongside the role and timeline", () => {
    render(<ProjectModal project={project} onClose={vi.fn()} />);

    for (const label of ["Role", "Timeline", "Category", "Status"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("treats a link with no url as unpublished rather than as a repository", () => {
    // A placeholder has a label but no destination, so it cannot stand in for
    // a repository: the note has to key off a real url, not off the count.
    const pending: ProjectDetail = {
      ...project,
      links: [{ label: "GitHub repository", url: "" }],
    };
    render(<ProjectModal project={pending} onClose={vi.fn()} />);

    expect(screen.queryByRole("link", { name: /github repository/i })).not.toBeInTheDocument();
    expect(screen.getByText(/no public repository linked/i)).toBeInTheDocument();
  });

  it("locks the page behind it and releases on close", async () => {
    const { rerender } = render(<ProjectModal project={project} onClose={vi.fn()} />);
    expect(document.body.style.overflow).toBe("hidden");

    rerender(<ProjectModal project={null} onClose={vi.fn()} />);
    await waitFor(() => expect(document.body.style.overflow).not.toBe("hidden"));
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<ProjectModal project={project} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("returns focus to whatever opened it", async () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: /open project/i });
    trigger.focus();
    fireEvent.click(trigger);

    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    // Without the restore, a keyboard user is dumped at the top of the page.
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("keeps Tab inside the dialog", async () => {
    render(<ProjectModal project={project} onClose={vi.fn()} />);
    const dialog = await screen.findByRole("dialog");
    const focusable = dialog.querySelectorAll<HTMLElement>("a[href], button");
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    last.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});
