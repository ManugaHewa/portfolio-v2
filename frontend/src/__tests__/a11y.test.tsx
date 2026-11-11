import { render, screen, act, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import axe from "axe-core";
import App from "../App";
import { PrivacyPage } from "../components/PrivacyPage";
import type { ProjectSummary } from "../types";

const base: Omit<ProjectSummary, "slug" | "title" | "tier"> = {
  subtitle: "One line of tagline.",
  stack: ["TypeScript", "Node.js"],
  role: "Solo developer",
  timeline: "2026",
  category: "Full-stack web",
  status: "Completed",
  problem: "The problem it solved.",
  outcomes: ["Shipped to a real client."],
  links: [{ label: "GitHub repository", url: "https://github.com/example/repo" }],
};

const PROJECTS: ProjectSummary[] = [
  { ...base, slug: "rxflow", title: "RxFlow", tier: 1 },
  { ...base, slug: "mail-client", title: "Mail Client", tier: 2 },
];

vi.mock("../api", () => ({
  api: {
    getProjects: () => Promise.resolve(PROJECTS),
    getProject: (slug: string) =>
      Promise.resolve({
        ...PROJECTS.find((p) => p.slug === slug),
        context: "Context.",
        problem: "Problem.",
        scope: ["One"],
        stakeholders: [],
        requirements: [],
        nonFunctional: [],
        deliveryProcess: [],
        risks: [],
        challenges: [],
        highlights: [],
        nextSteps: [],
        learned: null,
      }),
    sendContactMessage: () => Promise.resolve({ status: "received" }),
  },
}));

/**
 * axe's structural rules: roles, names, nesting, landmarks, heading order.
 * Contrast needs real layout and real colours, which jsdom does not have; it
 * is measured in a browser instead (docs/audit-2026-10.md, appendix E).
 */
async function violations(root: Element = document.body) {
  const result = await axe.run(root, {
    rules: { "color-contrast": { enabled: false } },
  });
  return result.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
  );
}

describe("page landmarks", () => {
  it("offers a skip link pointing at the main landmark", async () => {
    // The stylesheet carried .skip-link from the previous site, but the React
    // rebuild never rendered it, so keyboard users had to tab the whole nav on
    // every load. This pins the markup to the styles.
    await act(async () => { render(<App />); });

    const skip = screen.getByRole("link", { name: /skip to content/i });
    expect(skip).toHaveAttribute("href", "#main");
    expect(document.querySelector("main")).toHaveAttribute("id", "main");
  });

  it("gives every section a heading that names it", async () => {
    await act(async () => { render(<App />); });
    // The redesign's sections (SPEC.md section 5): the work index under the
    // hero, the case studies with Other work inside, how it's built, skills
    // and contact. Each is labelled by a real heading with a real name.
    for (const id of ["work-index", "work", "other-work", "pipeline", "skills", "contact"]) {
      const section = document.getElementById(id);
      expect(section, `#${id} should exist`).not.toBeNull();
      const labelledBy = section?.getAttribute("aria-labelledby");
      expect(labelledBy, `#${id} should be labelled`).toBeTruthy();
      const heading = document.getElementById(labelledBy ?? "");
      expect(heading, `#${id}'s label should exist`).not.toBeNull();
      expect(heading?.tagName, `#${id} should be labelled by a heading`).toMatch(/^H[2-4]$/);
      expect(heading?.textContent?.trim(), `#${id}'s heading should have text`).toBeTruthy();
    }
    // One h1, and it is the name.
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Manuga Hewa Pathirana" })).toBeInTheDocument();
  });

  it("names the person and a way to reach them in the footer", async () => {
    await act(async () => { render(<App />); });
    const footer = screen.getByRole("contentinfo");

    expect(footer).toHaveTextContent("Manuga Hewa Pathirana");
    expect(footer).toHaveTextContent("Milton, Ontario");
    // Contact offers an Email link too, so look inside the footer.
    expect(within(footer).getByRole("link", { name: "Email" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^mailto:/),
    );
    expect(within(footer).getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
  });
});

describe("axe, structural rules", () => {
  it("finds nothing on the home page", async () => {
    await act(async () => { render(<App />); });
    expect(await violations()).toEqual([]);
  });

  it("finds nothing with a project open", async () => {
    await act(async () => { render(<App />); });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /read the case study for rxflow/i }));
    });
    await screen.findByRole("dialog");
    expect(await violations()).toEqual([]);
  });

  it("finds nothing on the privacy page", async () => {
    render(<PrivacyPage />);
    expect(await violations()).toEqual([]);
  });
});
