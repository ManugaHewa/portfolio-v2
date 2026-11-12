import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectModal } from "../components/ProjectModal";
import type { ProjectDetail, ProjectSummary } from "../types";
import { projectNumber } from "../stats";
import { Wrap } from "./motion/helpers";

const detail: ProjectDetail = {
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
  nonFunctional: ["Usable on a phone"],
  deliveryProcess: ["Schema first"],
  risks: ["Duplicate records on re-import"],
  challenges: ["requireAdmin resolved to undefined on an import mismatch"],
  outcomes: ["Validated donations only"],
  highlights: [],
  nextSteps: [],
  learned: "Prisma migrations and schema design against a real system.",
};

/** What the list endpoint knows: the dialog opens with this, before the detail. */
const summary: ProjectSummary = {
  slug: detail.slug,
  title: detail.title,
  subtitle: detail.subtitle,
  stack: detail.stack,
  links: detail.links,
  role: detail.role,
  timeline: detail.timeline,
  category: detail.category,
  status: detail.status,
  tier: detail.tier,
  problem: detail.problem,
  outcomes: detail.outcomes,
};

type ModalProps = Partial<Parameters<typeof ProjectModal>[0]>;

const renderModal = (props: ModalProps = {}) => {
  const all = {
    project: summary,
    detail,
    onClose: vi.fn(),
    returnFocusTo: null,
    ...props,
  };
  const view = render(
    <Wrap>
      <ProjectModal {...all} />
    </Wrap>,
  );
  const rerender = (next: ModalProps) =>
    view.rerender(
      <Wrap>
        <ProjectModal {...all} {...next} />
      </Wrap>,
    );
  return { ...view, rerender, onClose: all.onClose };
};

/** The page around the dialog: a trigger that opens it and is handed back focus. */
function Harness() {
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);
  return (
    <Wrap>
      <button type="button" onClick={(e) => setTrigger(e.currentTarget)}>
        Open project
      </button>
      <ProjectModal
        project={trigger ? summary : null}
        detail={trigger ? detail : null}
        onClose={() => setTrigger(null)}
        returnFocusTo={trigger}
      />
    </Wrap>
  );
}

afterEach(() => {
  document.documentElement.style.overflow = "";
});

describe("ProjectModal", () => {
  it("renders nothing on the server: the prerendered HTML has no dialog", () => {
    const html = renderToString(
      <Wrap>
        <ProjectModal project={summary} detail={detail} onClose={() => {}} returnFocusTo={null} />
      </Wrap>,
    );
    expect(html).not.toContain("dialog");
  });

  it("is portalled to <body>, outside the page", () => {
    const { container } = renderModal();
    const dialog = screen.getByRole("dialog");
    expect(container.contains(dialog)).toBe(false);
    expect(document.body.contains(dialog)).toBe(true);
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName(detail.title);
  });

  it("opens with the summary and a loading state, then fills in the detail", () => {
    const { rerender } = renderModal({ detail: null });

    expect(screen.getByRole("heading", { level: 2, name: detail.title })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/loading the full case study/i);
    // The summary already carries the problem and the outcomes.
    expect(screen.getByText("Problem")).toBeInTheDocument();
    expect(screen.queryByText("Scope")).not.toBeInTheDocument();

    rerender({ detail });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("Scope")).toBeInTheDocument();
  });

  it("ignores a detail that belongs to another project", () => {
    renderModal({ detail: { ...detail, slug: "alice" } });
    expect(screen.queryByText("Scope")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("says so when the detail fails to load", () => {
    renderModal({ detail: null, detailError: true });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn’t load the full case study. Try again in a moment.",
    );
  });

  it("renders only the sections that have content", () => {
    renderModal();

    for (const title of [
      "Context",
      "Problem",
      "Scope",
      "Technical challenges",
      "How it was delivered, and what came of it",
      "What I learned",
      "Links",
    ]) {
      expect(screen.getByRole("heading", { level: 3, name: title })).toBeInTheDocument();
    }
    // highlights and nextSteps are empty, so their headings must not appear.
    expect(screen.queryByRole("heading", { name: "Highlights" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Next steps" })).not.toBeInTheDocument();
  });

  it("tells the delivery as one line that ends in the outcomes, said once", () => {
    renderModal();
    const dialog = screen.getByRole("dialog");
    const steps = Array.from(dialog.querySelectorAll(".process-list > li"));
    expect(steps).toHaveLength(detail.deliveryProcess.length + (detail.outcomes.length > 0 ? 1 : 0));
    expect(steps[0]).toHaveTextContent(detail.deliveryProcess[0]);
    const last = steps[steps.length - 1];
    expect(last).toHaveClass("is-outcome");
    for (const o of detail.outcomes) expect(screen.getAllByText(o)).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "Outcomes" })).not.toBeInTheDocument();
  });

  it("shows the number and category as a readout, and role, timeline and status as facts", () => {
    renderModal();
    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelector(".dialog-readout")).toHaveTextContent(`${projectNumber("dms")} · Full-stack web`);
    for (const label of ["Role", "Timeline", "Status"]) {
      expect(screen.getByText(label, { selector: "dt" })).toBeInTheDocument();
    }
    expect(dialog.querySelector(".dialog-status")).toHaveClass("is-ongoing");
  });

  it("opens with the case card's figure at its head: the number and what the project is", () => {
    renderModal();
    const dialog = screen.getByRole("dialog");
    const figure = dialog.querySelector(".dialog-figure") as HTMLElement;
    expect(figure.querySelector(".case-figure-num")).toHaveAttribute("data-number", projectNumber("dms"));
    expect(figure).toHaveTextContent(detail.subtitle);
    // The plate says it, so the head does not say it again.
    expect(screen.getAllByText(detail.subtitle)).toHaveLength(1);
  });

  it("lists the stack under its own label, one item per name", () => {
    renderModal({ detail: { ...detail, stack: ["Node.js", "MongoDB Atlas", "Docker"] } });
    const stack = screen.getByRole("heading", { level: 3, name: "Stack" }).nextElementSibling as HTMLElement;
    expect(stack.tagName).toBe("UL");
    expect(Array.from(stack.querySelectorAll("li")).map((li) => li.textContent)).toEqual([
      "Node.js",
      "MongoDB Atlas",
      "Docker",
    ]);
  });

  it("gives a dialog opened while the last one is still closing its own name and its own trap", async () => {
    const other: ProjectSummary = { ...summary, slug: "alice", title: "Alice Bot" };
    const { rerender } = renderModal({ detail: null });
    const first = screen.getByRole("dialog");

    // Close the first and open the second at once: the first stays mounted
    // for its exit while the second mounts.
    rerender({ project: other, detail: null });
    const second = screen.getByRole("dialog", { name: "Alice Bot" });
    expect(second).not.toBe(first);
    expect(document.querySelectorAll(".dialog-root")).toHaveLength(2);
    const ids = Array.from(document.querySelectorAll(".dialog-title")).map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);

    // Once the first has gone, its unmount must not have taken the second's
    // panel with it: Tab still wraps inside the second.
    await waitFor(() => expect(document.querySelectorAll(".dialog-root")).toHaveLength(1));
    const focusable = second.querySelectorAll<HTMLElement>("a[href], button");
    const last = focusable[focusable.length - 1];
    last.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(focusable[0]);
  });

  it("treats a link with no url as unpublished rather than as a repository", () => {
    // A placeholder has a label but no destination, so it cannot stand in for
    // a repository: the note has to key off a real url, not off the count.
    const pending = { ...detail, links: [{ label: "GitHub repository", url: "" }] };
    renderModal({ project: { ...summary, links: pending.links }, detail: pending });

    expect(screen.queryByRole("link", { name: /github repository/i })).not.toBeInTheDocument();
    expect(screen.getByText(/link not published yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no public repository linked/i)).toBeInTheDocument();
  });

  it("locks the page behind it and releases on close", async () => {
    const { rerender } = renderModal();
    expect(document.documentElement.style.overflow).toBe("hidden");

    rerender({ project: null, detail: null });
    await waitFor(() => expect(document.documentElement.style.overflow).not.toBe("hidden"));
  });

  it("makes the closing layer inert the moment its exit starts", async () => {
    const { rerender } = renderModal();
    const root = document.querySelector(".dialog-root") as HTMLElement;
    expect(root).not.toHaveAttribute("inert");

    rerender({ project: null, detail: null });
    // Still on screen while it fades or shrinks back, but out of reach.
    if (root.isConnected) expect(root).toHaveAttribute("inert");
    await waitFor(() => expect(document.querySelector(".dialog-root")).toBeNull());
  });

  it("closes on Escape and from the Close button", () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /close project details/i }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("moves focus into the dialog and returns it to whatever opened it", async () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: /open project/i });
    trigger.focus();
    await act(async () => {
      fireEvent.click(trigger);
    });

    const dialog = await screen.findByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(window, { key: "Escape" });
    // Without the restore, a keyboard user is dumped at the top of the page.
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("keeps Tab inside the dialog", () => {
    renderModal();
    const dialog = screen.getByRole("dialog");
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
