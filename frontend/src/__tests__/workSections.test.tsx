import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { Work } from "../components/work/Work";
import { PROJECTS, projectSummaries } from "../../../content/projects";
import { projectNumber } from "../stats";
import { ALSO_ON_GITHUB } from "../repositories";
import type { ProjectDetail, ProjectSummary } from "../types";
import { Wrap } from "./motion/helpers";

const ALL = projectSummaries() as ProjectSummary[];
const CASES = ALL.filter((p) => p.tier === 1);
const OTHER = ALL.filter((p) => p.tier !== 1);

const api = vi.hoisted(() => ({
  getProjects: vi.fn(),
  getProject: vi.fn(),
  sendContactMessage: vi.fn(),
}));

vi.mock("../api", () => ({ api }));

beforeEach(() => {
  api.getProjects.mockReset().mockResolvedValue(ALL);
  api.getProject.mockReset().mockImplementation((slug: string) => {
    const full = PROJECTS.find((p) => p.slug === slug);
    // Shaped like the API: a list left out comes back as [].
    const lists = { scope: [], stakeholders: [], requirements: [], nonFunctional: [], deliveryProcess: [], risks: [], challenges: [], highlights: [], nextSteps: [] };
    return Promise.resolve({ ...lists, context: null, learned: null, ...ALL.find((p) => p.slug === slug), ...full } as ProjectDetail);
  });
  api.sendContactMessage.mockReset().mockResolvedValue({ status: "received" });
});

const renderApp = async () => {
  await act(async () => {
    render(<App />);
  });
};

const workSection = () => document.getElementById("work") as HTMLElement;

describe("the work section", () => {
  it("gives each tier-1 project a card, in content order, with its number", async () => {
    await renderApp();

    const cards = Array.from(workSection().querySelectorAll<HTMLElement>("article.case-card"));
    expect(cards.map((c) => c.id)).toEqual(CASES.map((p) => `case-${p.slug}`));
    cards.forEach((card, i) => {
      expect(card.querySelector(".case-num")).toHaveTextContent(projectNumber(CASES[i].slug));
    });
  });

  it("is headed 'Case studies', and keeps the heading outline unbroken", async () => {
    await renderApp();
    const work = within(workSection());

    // h2 section, h3 card titles, h3 subsection: no level is skipped.
    expect(work.getByRole("heading", { level: 2, name: "Case studies" })).toBeInTheDocument();
    for (const p of CASES) {
      expect(work.getByRole("heading", { level: 3, name: p.title })).toBeInTheDocument();
    }
    expect(work.getByRole("heading", { level: 3, name: "Other work" })).toBeInTheDocument();
  });

  it("puts the other work and the repositories in one list, numbered after the case studies", async () => {
    await renderApp();

    const other = document.getElementById("other-work") as HTMLElement;
    const rows = within(other).getAllByRole("listitem");
    expect(rows).toHaveLength(OTHER.length + ALSO_ON_GITHUB.length);

    OTHER.forEach((p, i) => {
      expect(rows[i].id).toBe(`other-${p.slug}`);
      expect(rows[i].querySelector(".other-num")).toHaveTextContent(projectNumber(p.slug));
      expect(within(rows[i]).getByRole("button", { name: p.title })).toBeInTheDocument();
    });
    for (const r of ALSO_ON_GITHUB) {
      expect(within(other).getByRole("link", { name: new RegExp(r.name) })).toHaveAttribute("href", r.url);
    }
    // No case study appears twice.
    expect(within(other).queryByText(CASES[0].title)).not.toBeInTheDocument();
  });

  it("opens a case study from its card, takes the page out of reach, and gives it back", async () => {
    await renderApp();
    const p = CASES[0];
    const open = screen.getByRole("button", { name: `Read the case study for ${p.title}` });
    open.focus();

    await act(async () => {
      fireEvent.click(open);
    });

    const dialog = await screen.findByRole("dialog", { name: p.title });
    expect(api.getProject).toHaveBeenCalledWith(p.slug);
    // A screen reader's own cursor ignores focus traps, so the page behind
    // has to be inert, not just out of the Tab order.
    expect(document.getElementById("app-shell")).toHaveAttribute("inert");
    expect(document.getElementById("app-shell")?.contains(dialog)).toBe(false);

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(document.getElementById("app-shell")).not.toHaveAttribute("inert"));
    await waitFor(() => expect(document.activeElement).toBe(open));
  });

  it("opens an other-work project from its row", async () => {
    await renderApp();
    const p = OTHER[0];
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: p.title }));
    });
    expect(await screen.findByRole("dialog", { name: p.title })).toBeInTheDocument();
  });

  it("shows the failure message inside the dialog when the detail does not load", async () => {
    api.getProject.mockRejectedValue(new Error("down"));
    await renderApp();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: `Read the case study for ${CASES[1].title}` }));
    });
    expect(await screen.findByText("Couldn’t load the full case study. Try again in a moment.")).toBeInTheDocument();
  });
});

describe("Work states", () => {
  const renderWork = (props: Partial<Parameters<typeof Work>[0]>) =>
    render(
      <Wrap>
        <Work cases={[]} otherWork={[]} loading={false} error={false} onOpen={() => {}} {...props} />
      </Wrap>,
    );

  it("holds the space with two skeleton cards while loading", () => {
    const { container } = renderWork({ loading: true });
    expect(container.querySelectorAll(".case-skeleton")).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent("Loading projects");
  });

  it("explains a failed load", () => {
    renderWork({ error: true });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn’t load the projects. Reloading the page usually fixes it.",
    );
  });

  it("says when there is nothing to show", () => {
    renderWork({});
    expect(screen.getByText("No projects to show yet.")).toBeInTheDocument();
  });

  it("puts the field scene first in the section", () => {
    const { container } = renderWork({ cases: CASES, otherWork: OTHER });
    const section = container.querySelector("section#work") as HTMLElement;
    expect(section).toHaveAttribute("aria-labelledby", "work-heading");
    // Scene renders nothing in jsdom (no WebGL), or its host first.
    const first = section.firstElementChild as HTMLElement;
    expect(first.classList.contains("container") || first.classList.contains("scene-field")).toBe(true);
  });
});
