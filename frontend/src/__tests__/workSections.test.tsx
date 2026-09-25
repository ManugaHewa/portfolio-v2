import { render, screen, act, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import App from "../App";
import type { ProjectSummary } from "../types";

const base: Omit<ProjectSummary, "slug" | "title" | "tier"> = {
  subtitle: "One line of tagline.",
  stack: ["TypeScript", "Node.js"],
  role: "Solo developer",
  timeline: "2026",
  category: "Full-stack web",
  status: "Completed",
  outcomes: ["Shipped to a real client."],
  links: [],
};

const PROJECTS: ProjectSummary[] = [
  { ...base, slug: "rxflow", title: "RxFlow", tier: 1 },
  { ...base, slug: "dms", title: "Donation Management System", tier: 1 },
  { ...base, slug: "mail-client", title: "Mail Client", tier: 2 },
];

vi.mock("../api", () => ({
  api: {
    getProjects: () => Promise.resolve(PROJECTS),
    getProject: () => Promise.resolve(null),
    sendContactMessage: () => Promise.resolve({ id: "1", status: "received" }),
  },
}));

const renderApp = async () => {
  await act(async () => {
    render(<App />);
  });
};

describe("the work section", () => {
  it("gives a card to tier 1 and a row to everything else", async () => {
    await renderApp();

    // Two cards, so two case-study cues, and the row does not get one.
    expect(screen.getAllByText(/read the case study/i)).toHaveLength(2);

    const other = document.querySelector(".other-work");
    expect(other).not.toBeNull();
    expect(within(other as HTMLElement).getByText("Mail Client")).toBeInTheDocument();
    expect(within(other as HTMLElement).queryByText("RxFlow")).not.toBeInTheDocument();
  });

  it("folds the smaller repositories into the same Other work list", async () => {
    await renderApp();

    // One subsection, not two: a project row and a repository row sit in the
    // same list, so a second heading for two links is not needed.
    const list = document.querySelector(".other-work .projects-compact-list");
    expect(list).not.toBeNull();

    const rows = within(list as HTMLElement);
    expect(rows.getByText("Mail Client")).toBeInTheDocument();
    expect(rows.getByRole("link", { name: /Portfolio/ })).toBeInTheDocument();
    expect(rows.getByRole("link", { name: /Calculators/ })).toBeInTheDocument();
    expect(screen.queryByText(/also on github/i)).not.toBeInTheDocument();
  });

  it("keeps the heading outline unbroken through the subsection", async () => {
    await renderApp();

    // h2 section, h3 card titles, h3 subsection, h4 rows: no level is skipped,
    // which is what a screen-reader outline walks.
    expect(screen.getByRole("heading", { level: 2, name: /selected work/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "RxFlow" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: /other work/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 4, name: "Mail Client" })).toBeInTheDocument();
  });
});
