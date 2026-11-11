import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaseCard } from "../components/work/CaseCard";
import { isOngoing, stackLine } from "../components/work/workUtils";
import { projectNumber } from "../stats";
import type { ProjectSummary } from "../types";
import { FINE, REDUCED, Wrap, find, installMatchMedia } from "./motion/helpers";

const project: ProjectSummary = {
  slug: "dms",
  title: "Donation Management System",
  subtitle: "Centralized donation operations.",
  stack: ["React", "TypeScript", "Node.js", "Express", "Prisma", "PostgreSQL", "Docker", "Nginx"],
  role: "Full-stack engineer",
  timeline: "2025 to now",
  category: "Full-stack web",
  status: "In active development",
  tier: 1,
  problem: "Tracking was fragmented across channels.",
  outcomes: ["Validated donations only.", "Ran for a real organisation."],
  links: [
    { label: "GitHub repository", url: "https://github.com/example/dms" },
    { label: "Live demo", url: "" },
  ],
};

let media: ReturnType<typeof installMatchMedia> | null = null;

afterEach(() => {
  media?.restore();
  media = null;
});

const renderCard = (p: ProjectSummary = project, onOpen = vi.fn()) => {
  const view = render(
    <Wrap>
      <CaseCard project={p} index={0} onOpen={onOpen} />
    </Wrap>,
  );
  return { ...view, onOpen, card: find(view.container, "article") };
};

describe("CaseCard", () => {
  it("is article#case-<slug>, named by its title", () => {
    const { card } = renderCard();
    expect(card.id).toBe("case-dms");
    expect(card).toHaveAccessibleName(project.title);
    expect(screen.getByRole("heading", { level: 3, name: project.title })).toBeInTheDocument();
  });

  it("reads the category on the left and the status with its dot on the right", () => {
    const { card } = renderCard();
    const readout = find(card, ".case-readout");
    // The figure carries the number; the readout does not repeat it.
    expect(readout).toHaveTextContent("Full-stack web");
    expect(readout).not.toHaveTextContent(projectNumber("dms"));
    expect(find(readout, ".case-status")).toHaveClass("is-ongoing");

    const done = renderCard({ ...project, slug: "alice", status: "Completed" });
    expect(find(done.card, ".case-status")).not.toHaveClass("is-ongoing");
  });

  it("draws its figure from real data, never a 'screenshot to come' slot", () => {
    const { card } = renderCard();
    const figure = find(card, ".case-figure");

    // The number is decoration (CSS generated content), not text.
    const number = find(figure, ".case-figure-num");
    expect(number).toHaveAttribute("data-number", projectNumber("dms"));
    expect(number).toHaveAttribute("aria-hidden", "true");
    expect(number).toBeEmptyDOMElement();
    // What the project is, which the text below does not say again.
    expect(find(figure, ".case-figure-line")).toHaveTextContent(project.subtitle);
    expect(card).not.toHaveTextContent(/screenshot/i);
  });

  it("says each thing once: the outcome in Result, the stack in one line", () => {
    const { card } = renderCard();
    const blocks = within(find(card, ".case-blocks"));
    expect(blocks.getByText("Problem")).toBeInTheDocument();
    expect(blocks.getByText(project.problem as string)).toBeInTheDocument();
    expect(blocks.getByText(project.outcomes[0])).toBeInTheDocument();
    expect(within(card).getAllByText(project.outcomes[0])).toHaveLength(1);
    expect(within(card).getAllByText(project.subtitle)).toHaveLength(1);
    expect(card.querySelectorAll(".case-stack")).toHaveLength(1);
    expect(find(card, ".case-figure")).not.toHaveTextContent("TypeScript");
  });

  it("leaves Result out when there are no outcomes", () => {
    const { card } = renderCard({ ...project, outcomes: [] });
    expect(find(card, ".case-figure-line")).toHaveTextContent(project.subtitle);
    expect(within(card).queryByText("Result")).not.toBeInTheDocument();
  });

  it("shortens the stack to six names and a count", () => {
    const { card } = renderCard();
    expect(find(card, ".case-stack")).toHaveTextContent(
      "React · TypeScript · Node.js · Express · Prisma · PostgreSQL +2",
    );
  });

  it("opens with a real button, named for its project, handing itself over as the trigger", () => {
    const { onOpen } = renderCard();
    const button = screen.getByRole("button", { name: `Read the case study for ${project.title}` });
    fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledWith(project, button);
  });

  it("opens from the figure too, still handing over the button for focus to return to", () => {
    const { card, onOpen } = renderCard();
    fireEvent.click(find(card, ".case-figure-line"));
    const button = screen.getByRole("button", { name: `Read the case study for ${project.title}` });
    expect(onOpen).toHaveBeenCalledWith(project, button);
  });

  it("links what is published and marks what is not", () => {
    const { card } = renderCard();
    expect(within(card).getByRole("link", { name: "GitHub repository" })).toHaveAttribute(
      "href",
      "https://github.com/example/dms",
    );
    expect(within(card).queryByRole("link", { name: /live demo/i })).not.toBeInTheDocument();
    expect(within(card).getByText(/link not published yet/)).toBeInTheDocument();
  });

  it("enters with data-reveal, so the no-JS and reduced-motion rules can show it", () => {
    const { container } = renderCard();
    expect(find(container, ".case-cell")).toHaveAttribute("data-reveal");
  });

  it("tilts only for a fine pointer with motion allowed", () => {
    media = installMatchMedia([FINE]);
    const fine = renderCard();
    expect(find(fine.card, ".tilt-surface")).toHaveAttribute("data-tilt", "on");
    fine.unmount();

    media.set([FINE, REDUCED]);
    const reduced = renderCard();
    expect(find(reduced.card, ".tilt-surface")).not.toHaveAttribute("data-tilt");
    reduced.unmount();

    media.set([]);
    const coarse = renderCard();
    expect(find(coarse.card, ".tilt-surface")).not.toHaveAttribute("data-tilt");
  });

  it("tilts only what is drawn on the figure: not the plate, not the text", () => {
    const { card } = renderCard();
    const visual = find(card, ".tilt-visual");
    expect(visual.contains(find(card, ".case-content"))).toBe(false);
    expect(visual.contains(find(card, ".case-figure-line"))).toBe(true);
    expect(find(card, ".case-figure").contains(visual)).toBe(true);
  });
});

describe("workUtils", () => {
  it("counts every status not starting 'Completed' as ongoing", () => {
    expect(isOngoing("In active development")).toBe(true);
    expect(isOngoing("Completed")).toBe(false);
    expect(isOngoing("Completed and deployed")).toBe(false);
    expect(isOngoing(null)).toBe(false);
  });

  it("joins a stack with middle dots and counts the rest", () => {
    expect(stackLine(["A", "B"], 3)).toBe("A · B");
    expect(stackLine(["A", "B", "C", "D"], 3)).toBe("A · B · C +1");
  });
});
