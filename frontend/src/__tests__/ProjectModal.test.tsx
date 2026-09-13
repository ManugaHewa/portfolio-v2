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
  context: "Built for a working organisation.",
  problem: "Tracking was fragmented across channels.",
  scope: ["Donor records", "Validation workflow"],
  stakeholders: ["Treasurers"],
  requirements: ["Audit logs"],
  nonFunctional: ["WCAG 2.1"],
  deliveryProcess: ["Schema first"],
  risks: ["Duplicate records on re-import"],
  outcomes: ["Faster release cycles"],
  highlights: [],
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
    // highlights is empty, so its heading must not appear at all.
    expect(screen.queryByText("Highlights")).not.toBeInTheDocument();
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
