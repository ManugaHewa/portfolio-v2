import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WorkIndex } from "../components/WorkIndex";
import { drawCard, initialDeck, shuffleDeck, tableCards, thrown } from "../components/deck/useDeck";
import { STATS, projectNumber } from "../stats";
import { projectSummaries } from "../../../content/projects";
import type { ProjectSummary } from "../types";
import { Wrap } from "./motion/helpers";

const all = projectSummaries() as ProjectSummary[];
// Page order: the case studies first, then the other work.
const projects = [...all.filter((p) => p.tier === 1), ...all.filter((p) => p.tier !== 1)];

const renderIndex = (onOpen = vi.fn()) => ({
  onOpen,
  ...render(
    <Wrap>
      <WorkIndex projects={projects} onOpen={onOpen} />
    </Wrap>,
  ),
});

const faceUp = (container: HTMLElement) => container.querySelector(".pcard.is-up .pcard-title")?.textContent;

describe("WorkIndex", () => {
  it("is the #work-index section, headed 'Selected work'", () => {
    const { container } = renderIndex();
    const section = container.querySelector("section#work-index")!;
    expect(section).not.toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Selected work" })).toBeInTheDocument();
    expect(section).toHaveAttribute("aria-labelledby", "work-index-heading");
  });

  it("reads its three counts from the data", () => {
    const { container } = renderIndex();
    const readout = container.querySelector(".work-index-readout")!;
    const sr = Array.from(readout.querySelectorAll(".odometer .visually-hidden")).map((n) => n.textContent);
    expect(sr).toEqual([String(STATS.projects), String(STATS.caseStudies), String(STATS.repositories)]);
  });
});

describe("the deck", () => {
  it("prerenders the first project face up, so the page never opens on a blank pile", () => {
    const html = renderToString(
      <Wrap>
        <WorkIndex projects={projects} onOpen={() => {}} />
      </Wrap>,
    );
    const host = document.createElement("div");
    host.innerHTML = html;
    expect(host.querySelector(".pcard.is-up .pcard-title")?.textContent).toBe(projects[0].title);
    // Every project is in the page as a link, for crawlers and for no-JS visitors.
    const links = host.querySelectorAll(".deck-list a");
    expect(links).toHaveLength(projects.length);
  });

  it("draws the projects in page order, and says each one", () => {
    const { container } = renderIndex();
    expect(faceUp(container)).toBe(projects[0].title);
    const draw = screen.getByRole("button", { name: "Draw a card" });
    act(() => {
      fireEvent.click(draw);
    });
    expect(faceUp(container)).toBe(projects[1].title);
    expect(container.querySelector("[aria-live='polite']")).toHaveTextContent(
      `Card 2 of ${projects.length}: ${projects[1].title}.`,
    );
    expect(container.querySelector(".deck-count")).toHaveTextContent(`02 / ${projects.length}`);
  });

  it("opens the face-up card's case study, handing over its button", () => {
    const { onOpen } = renderIndex();
    const open = screen.getByRole("button", { name: `Read the case study for ${projects[0].title}` });
    fireEvent.click(open);
    expect(onOpen).toHaveBeenCalledWith(projects[0], open);
  });

  it("keeps the earlier draws out of the way of assistive technology", () => {
    const { container } = renderIndex();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Draw a card" }));
    });
    const under = container.querySelectorAll(".pcard.is-under");
    expect(under.length).toBeGreaterThan(0);
    under.forEach((c) => {
      expect(c).toHaveAttribute("aria-hidden", "true");
      expect(c.querySelector("button")).toBeNull();
    });
  });

  it("offers to shuffle and deal again once the deck is empty", () => {
    renderIndex();
    const draw = screen.getByRole("button", { name: "Draw a card" });
    for (let i = 1; i < projects.length; i++) {
      act(() => {
        fireEvent.click(draw);
      });
    }
    const again = screen.getByRole("button", { name: "Shuffle and deal again" });
    act(() => {
      fireEvent.click(again);
    });
    expect(screen.getByRole("button", { name: "Draw a card" })).toBeInTheDocument();
  });

  it("lists every project with its number and suit", () => {
    const { container } = renderIndex();
    const list = container.querySelector(".deck-list ol") as HTMLElement;
    const items = within(list).getAllByRole("link");
    expect(items).toHaveLength(projects.length);
    expect(items[0]).toHaveAttribute("href", `/work/${projects[0].slug}/`);
    expect(items[0].textContent).toContain(projectNumber(projects[0].slug));
    const other = projects.findIndex((p) => p.tier !== 1);
    expect(items[other]).toHaveAttribute("href", `/work/${projects[other].slug}/`);
    expect(items[other].querySelector(".pcard-suit")).toHaveClass("is-other");
  });
});

describe("deck logic", () => {
  it("starts with the first card turned over", () => {
    expect(initialDeck(3)).toEqual({ order: [0, 1, 2], drawn: 1, deal: 0 });
    expect(initialDeck(0).drawn).toBe(0);
  });

  it("draws one at a time and stops at the bottom", () => {
    let s = initialDeck(2);
    s = drawCard(s);
    expect(s.drawn).toBe(2);
    expect(drawCard(s)).toBe(s);
  });

  it("shuffles every card back, deals the new top card and counts the deal", () => {
    const s = shuffleDeck({ order: [0, 1, 2, 3], drawn: 4, deal: 0 }, () => 0);
    expect([...s.order].sort()).toEqual([0, 1, 2, 3]);
    expect(s.drawn).toBe(1);
    expect(s.deal).toBe(1);
  });

  it("puts the face-up card first on the table, then the ones under it", () => {
    expect(tableCards({ order: [4, 3, 2, 1, 0], drawn: 3, deal: 0 })).toEqual([2, 3, 4]);
    expect(tableCards({ order: [0, 1, 2, 3, 4, 5], drawn: 6, deal: 0 }, 4)).toEqual([5, 4, 3, 2]);
  });

  it("counts a far drag or a fast flick as a throw, and a nudge as nothing", () => {
    expect(thrown({ x: 120, y: 0 }, { x: 0, y: 0 })).toBe(true);
    expect(thrown({ x: 20, y: 10 }, { x: 900, y: 0 })).toBe(true);
    expect(thrown({ x: 20, y: 10 }, { x: 50, y: 30 })).toBe(false);
  });
});
