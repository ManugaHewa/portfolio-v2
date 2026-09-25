import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SkillsSection } from "../components/SkillsSection";
import { CATEGORIES, SKILLS } from "../skills";

// jsdom has no canvas implementation, so SkillsGraph's getContext("2d")
// returns null and it bails before drawing. That's the point of the guard:
// the surrounding section must still render and stay fully interactive.

describe("SkillsSection", () => {
  it("keeps every skill reachable once the dense domains are expanded", () => {
    // Cards show six skills by default so one 11-skill domain cannot dictate
    // the height of the whole row. Nothing is dropped: expanding reveals the
    // rest, and this walks that path to prove all 52 are still reachable.
    render(<SkillsSection />);

    for (const button of screen.getAllByRole("button", { name: /^Show \d+ more$/ })) {
      fireEvent.click(button);
    }

    for (const skill of SKILLS) {
      expect(
        screen.getAllByRole("button", { name: new RegExp(`^${skill.name}`) }).length,
        `${skill.name} should be reachable`
      ).toBeGreaterThan(0);
    }
  });

  it("caps each domain at six skills until asked for more", () => {
    render(<SkillsSection />);

    const dense = CATEGORIES.find(
      (c) => SKILLS.filter((s) => s.category === c.id).length > 6
    )!;
    const card = screen
      .getByRole("heading", { level: 4, name: dense.label })
      .closest(".domain-card")!;

    expect(card.querySelectorAll(".skill-pill")).toHaveLength(6);

    const more = within(card as HTMLElement).getByRole("button", { name: /^Show \d+ more$/ });
    fireEvent.click(more);

    const total = SKILLS.filter((s) => s.category === dense.id).length;
    expect(card.querySelectorAll(".skill-pill")).toHaveLength(total);
    expect(within(card as HTMLElement).getByRole("button", { name: /show fewer/i })).toBeInTheDocument();
  });

  it("shows a skill's blurb and evidence when its pill is selected", () => {
    render(<SkillsSection />);
    const target = SKILLS.find((s) => s.name === "Zod")!;
    fireEvent.click(screen.getByRole("button", { name: /^Zod/ }));

    expect(screen.getByRole("heading", { level: 3, name: "Zod" })).toBeInTheDocument();
    expect(screen.getByText(target.blurb)).toBeInTheDocument();
    expect(screen.getByText(target.evidence)).toBeInTheDocument();
  });

  it("toggles the pressed state of a selected skill", () => {
    render(<SkillsSection />);
    const pill = screen.getByRole("button", { name: /^Prisma/ });
    expect(pill).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(pill);
    expect(pill).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(pill);
    expect(pill).toHaveAttribute("aria-pressed", "false");
  });

  it("isolates one domain when a legend chip is clicked, and restores on re-click", () => {
    render(<SkillsSection />);
    const legend = screen.getByRole("group", { name: /filter skills by domain/i });
    const chips = within(legend).getAllByRole("button");
    expect(chips).toHaveLength(CATEGORIES.length);
    expect(chips.every((c) => c.getAttribute("aria-pressed") === "true")).toBe(true);

    fireEvent.click(chips[0]);
    expect(chips[0]).toHaveAttribute("aria-pressed", "true");
    expect(chips.slice(1).every((c) => c.getAttribute("aria-pressed") === "false")).toBe(true);

    // Clicking the last remaining category must not strand the user on an
    // empty graph. It restores all of them.
    fireEvent.click(chips[0]);
    expect(chips.every((c) => c.getAttribute("aria-pressed") === "true")).toBe(true);
  });

  it("gives each domain card a count and a depth bar with an accessible equivalent", () => {
    render(<SkillsSection />);

    for (const category of CATEGORIES) {
      const skills = SKILLS.filter((s) => s.category === category.id);
      const average = (skills.reduce((a, s) => a + s.level, 0) / skills.length).toFixed(1);

      // The bar is the visual; this label is what it means, for anyone who
      // cannot see it. Several domains can share an average, hence getAll.
      expect(
        screen.getAllByLabelText(`Average depth ${average} out of 5`).length
      ).toBeGreaterThan(0);

      const card = screen.getByRole("heading", { level: 4, name: category.label }).closest(".domain-card");
      expect(card?.querySelector(".domain-count")?.textContent).toBe(String(skills.length));
    }
  });

  it("reports the real skill and category counts", () => {
    render(<SkillsSection />);
    // Scoped to the stat tile: bare digits also appear in the legend counts.
    const statValue = (label: string) =>
      screen.getByText(label).closest(".skills-stat")?.querySelector(".skills-stat-value")
        ?.textContent;

    expect(statValue("technologies mapped")).toBe(String(SKILLS.length));
    expect(statValue("connected domains")).toBe(String(CATEGORIES.length));
  });
});
