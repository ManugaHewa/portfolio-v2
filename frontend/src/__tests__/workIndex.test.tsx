import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WorkIndex, deckKey } from "../components/WorkIndex";
import {
  CUT_MS,
  RIFFLE_MS,
  cutDeck,
  cutDepth,
  deckCards,
  drawCard,
  initialDeck,
  pullCard,
  shuffleDeck,
  tableCards,
  thrown,
} from "../components/deck/useDeck";
import { requestDeal, takeDeal } from "../lib/dealRequest";
import type { DeckState } from "../components/deck/useDeck";
import { cutAt, pilePose, ribbonPose, ribbonTimeline, spreadCentre, spreadPose } from "../components/deck/DeckTable";
import { gone, stepFlier } from "../lib/winCascade";
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
    const links = host.querySelectorAll(".deck-list ol a");
    expect(links).toHaveLength(projects.length);
  });

  it("sits the deck in a dealer's shoe, under the cards and out of the reading order", () => {
    const { container } = renderIndex();
    const shoe = container.querySelector(".deck-pile > .deck-shoe");
    expect(shoe).not.toBeNull();
    expect(shoe).toHaveAttribute("aria-hidden", "true");
    // First in the pile, so every card lies over it.
    expect(container.querySelector(".deck-pile")?.firstElementChild).toBe(shoe);
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
    // The joker turns up where the deck was, pointing to the contact form.
    expect(screen.getByRole("heading", { level: 3, name: "That's the deck" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Get in touch" })).toHaveAttribute("href", "#contact");
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

describe("deck interactions", () => {
  it("spreads the deck into cards to pick, and gathers it again", () => {
    const { container } = renderIndex();
    // jsdom lays nothing out, so the table is measured at a made-up size.
    const spread = screen.getByRole("button", { name: "Spread the deck" });
    act(() => {
      fireEvent.click(spread);
    });
    expect(spread).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Gather the deck" })).toBeInTheDocument();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Gather the deck" }));
    });
    expect(container.querySelector(".pcard.is-fanned")).toBeNull();
  });

  it("deals the project a skill asks for, once the table is on screen", () => {
    const { container } = renderIndex();
    const wanted = projects[projects.length - 1];
    act(() => {
      requestDeal(wanted.slug);
    });
    expect(faceUp(container)).toBe(wanted.title);
    expect(takeDeal()).toBeNull();
  });

  it("riffles before it deals the new top card", () => {
    vi.useFakeTimers();
    try {
      const { container } = renderIndex();
      act(() => {
        fireEvent.click(screen.getByRole("button", { name: "Shuffle" }));
      });
      // Every card back in the deck, nothing dealt, while it is riffled.
      expect(container.querySelector(".deck-count")).toHaveTextContent(`00 / ${projects.length}`);
      expect(container.querySelectorAll(".deck-pile .pcard")).toHaveLength(projects.length);
      act(() => {
        vi.advanceTimersByTime(RIFFLE_MS + 10);
      });
      expect(container.querySelector(".deck-count")).toHaveTextContent(`01 / ${projects.length}`);
      expect(container.querySelector("[aria-live='polite']")?.textContent).toMatch(/^Shuffled\. Card 1 of /);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("deck keys and the hand", () => {
  it("draws, spreads and shuffles from the keyboard while focus is in the section", () => {
    const { container } = renderIndex();
    const section = container.querySelector("section#work-index")!;
    act(() => {
      fireEvent.keyDown(section, { key: "d" });
    });
    expect(faceUp(container)).toBe(projects[1].title);
    act(() => {
      fireEvent.keyDown(section, { key: "S" });
    });
    expect(screen.getByRole("button", { name: "Gather the deck" })).toBeInTheDocument();
    act(() => {
      fireEvent.keyDown(section, { key: "s" });
    });
    expect(screen.getByRole("button", { name: "Spread the deck" })).toBeInTheDocument();
  });

  it("leaves keys with a modifier, repeats and other keys alone", () => {
    const base = { key: "d", altKey: false, ctrlKey: false, metaKey: false, repeat: false, target: document.createElement("div") };
    expect(deckKey(base)).toBe("draw");
    expect(deckKey({ ...base, key: "r" })).toBe("shuffle");
    expect(deckKey({ ...base, key: "C" })).toBe("cut");
    expect(deckKey({ ...base, ctrlKey: true })).toBeNull();
    expect(deckKey({ ...base, repeat: true })).toBeNull();
    expect(deckKey({ ...base, key: "x" })).toBeNull();
    const input = document.createElement("input");
    expect(deckKey({ ...base, target: input })).toBeNull();
  });

  it("puts the shortcuts on the buttons for assistive technology", () => {
    renderIndex();
    expect(screen.getByRole("button", { name: "Draw a card" })).toHaveAttribute("aria-keyshortcuts", "D");
    expect(screen.getByRole("button", { name: "Spread the deck" })).toHaveAttribute("aria-keyshortcuts", "S");
    expect(screen.getByRole("button", { name: "Shuffle" })).toHaveAttribute("aria-keyshortcuts", "R");
  });

  it("picks a card in the hand back up with a click", () => {
    const { container } = renderIndex();
    const draw = screen.getByRole("button", { name: "Draw a card" });
    act(() => {
      fireEvent.click(draw);
    });
    act(() => {
      fireEvent.click(draw);
    });
    expect(faceUp(container)).toBe(projects[2].title);
    const under = container.querySelector<HTMLElement>(".pcard.is-in-hand")!;
    act(() => {
      fireEvent.click(under);
    });
    expect(faceUp(container)).toBe(projects[1].title);
  });
});

describe("deck logic", () => {
  const state = (order: number[], drawn: number): DeckState => ({
    order,
    drawn,
    deal: 0,
    spread: false,
    riffling: false,
    cutting: 0,
    cuts: 0,
    cutMark: "",
  });

  it("starts with the first card turned over, gathered", () => {
    expect(initialDeck(3)).toEqual({
      order: [0, 1, 2],
      drawn: 1,
      deal: 0,
      spread: false,
      riffling: false,
      cutting: 0,
      cuts: 0,
      cutMark: "",
    });
    expect(initialDeck(0).drawn).toBe(0);
  });

  it("draws one at a time, gathers a spread deck, and stops at the bottom", () => {
    let s = { ...initialDeck(2), spread: true };
    s = drawCard(s);
    expect(s.drawn).toBe(2);
    expect(s.spread).toBe(false);
    expect(drawCard(s)).toBe(s);
  });

  it("does nothing while the deck is being riffled", () => {
    const s = { ...initialDeck(3), riffling: true };
    expect(drawCard(s)).toBe(s);
    expect(pullCard(s, 2)).toBe(s);
  });

  it("pulls a card out of the deck and deals it", () => {
    const s = pullCard(state([0, 1, 2, 3], 1), 3);
    expect(s.order).toEqual([0, 3, 1, 2]);
    expect(s.drawn).toBe(2);
    expect(tableCards(s)[0]).toBe(3);
  });

  it("brings a card already on the table back to the top of it", () => {
    const s = pullCard(state([0, 1, 2, 3], 3), 0);
    expect(s.order).toEqual([1, 2, 0, 3]);
    expect(s.drawn).toBe(3);
    expect(tableCards(s)).toEqual([0, 2, 1]);
    const same = state([0, 1], 2);
    expect(pullCard(same, 1).order).toEqual([0, 1]);
  });

  it("shuffles every card back into the deck for the riffle, dealing nothing yet", () => {
    const s = shuffleDeck(state([0, 1, 2, 3], 4), () => 0);
    expect([...s.order].sort()).toEqual([0, 1, 2, 3]);
    expect(s).toMatchObject({ drawn: 0, deal: 1, riffling: true, spread: false });
    expect(deckCards(s)).toHaveLength(4);
  });

  it("puts the face-up card first on the table, then the ones under it", () => {
    expect(tableCards(state([4, 3, 2, 1, 0], 3))).toEqual([2, 3, 4]);
    expect(tableCards(state([0, 1, 2, 3, 4, 5], 6), 4)).toEqual([5, 4, 3, 2]);
    expect(deckCards(state([4, 3, 2, 1, 0], 3))).toEqual([1, 0]);
  });

  it("counts a far drag or a fast flick as a throw, and a nudge as nothing", () => {
    expect(thrown({ x: 120, y: 0 }, { x: 0, y: 0 })).toBe(true);
    expect(thrown({ x: 20, y: 10 }, { x: 900, y: 0 })).toBe(true);
    expect(thrown({ x: 20, y: 10 }, { x: 50, y: 30 })).toBe(false);
  });
});

describe("deck geometry", () => {
  it("lays the ribbon across the table, the top card at the deck", () => {
    expect(ribbonPose(0, 12, 200)).toEqual({ x: 0, y: 0, rotate: 0 });
    expect(ribbonPose(11, 12, 200).x).toBeCloseTo(-200, 5);
    expect(ribbonPose(0, 1, 200)).toEqual({ x: 0, y: 0, rotate: 0 });
  });

  it("times the turnover so each card turns after the one to its left, and ends", () => {
    const t = ribbonTimeline(12);
    expect(t.up).toBeLessThan(t.down);
    expect(t.down).toBeLessThan(t.gather);
    expect(t.gather).toBeLessThan(t.done);
    expect(ribbonTimeline(13).done).toBeGreaterThan(t.done);
  });

  it("stacks the deck a little thicker per card, up to a point", () => {
    expect(pilePose(0)).toEqual({ x: 0, y: 0, rotate: -2 });
    expect(pilePose(3).x).toBeCloseTo(4.8, 5);
    expect(pilePose(20)).toEqual(pilePose(6));
  });

  it("spreads the cards evenly along an arc centred on the table, narrower when few are left", () => {
    const fan = Array.from({ length: 12 }, (_, k) => spreadPose(k, 12, 100));
    expect(fan[0].rotate).toBeCloseTo(-16, 5);
    expect(fan[11].rotate).toBeCloseTo(16, 5);
    expect(fan.every((p) => p.x === 100)).toBe(true);
    expect(Math.abs(spreadPose(0, 3, 0).rotate)).toBeLessThan(16);
    expect(spreadPose(0, 1, 0).rotate).toBeCloseTo(0, 5);
  });

  it("finds a spread card's real centre, swung out along the arc", () => {
    const flat = spreadCentre({ x: 0, y: 0, rotate: 0 }, 400);
    expect(flat).toEqual({ x: 0, y: 0, rotate: 0 });
    const right = spreadCentre({ x: 0, y: 0, rotate: 20 }, 400);
    expect(right.x).toBeGreaterThan(0);
    expect(right.y).toBeGreaterThan(0);
    const left = spreadCentre({ x: 0, y: 0, rotate: -20 }, 400);
    expect(left.x).toBeCloseTo(-right.x, 5);
  });
});

describe("the cut", () => {
  const state = (order: number[], drawn: number): DeckState => ({ ...initialDeck(order.length), order, drawn });

  it("puts the top packet under the rest, leaving the drawn cards alone", () => {
    const s = cutDeck(state([0, 1, 2, 3, 4, 5], 2), 3);
    expect(s.order).toEqual([0, 1, 5, 2, 3, 4]);
    expect(s.drawn).toBe(2);
    expect(s.cuts).toBe(1);
    expect(s.cutMark).toBe("0:2");
  });

  it("refuses a cut that would leave a packet empty, and one made while riffling", () => {
    const s = state([0, 1, 2, 3], 1);
    expect(cutDeck(s, 0)).toBe(s);
    expect(cutDeck(s, 3)).toBe(s);
    const riffling = { ...s, riffling: true };
    expect(cutDeck(riffling, 1)).toBe(riffling);
    // A cut on its way that cannot be made simply ends.
    expect(cutDeck({ ...s, cutting: 5 }, 5)).toMatchObject({ order: [0, 1, 2, 3], cutting: 0 });
  });

  it("cuts near the middle from the keyboard, never at either end", () => {
    expect(cutDepth(1)).toBe(0);
    expect(cutDepth(2)).toBe(1);
    for (const r of [0, 0.5, 0.999]) {
      const k = cutDepth(12, () => r);
      expect(k).toBeGreaterThanOrEqual(4);
      expect(k).toBeLessThanOrEqual(8);
    }
  });

  it("takes one card at the top of the edge and all but one at the bottom", () => {
    expect(cutAt(0, 12)).toBe(1);
    expect(cutAt(1, 12)).toBe(11);
    expect(cutAt(0.5, 12)).toBe(6);
    expect(cutAt(-2, 12)).toBe(1);
    expect(cutAt(0.5, 1)).toBe(0);
  });

  it("cuts on C, lifting the top packet aside before it goes under, and says so", () => {
    vi.useFakeTimers();
    try {
      const { container } = renderIndex();
      const section = container.querySelector("section#work-index") as HTMLElement;
      act(() => {
        fireEvent.keyDown(section, { key: "c" });
      });
      // The packet is out: the deck has not changed order yet.
      expect(container.querySelector("[aria-live='polite']")?.textContent).toBe("");
      act(() => {
        vi.advanceTimersByTime(CUT_MS + 10);
      });
      expect(container.querySelector("[aria-live='polite']")?.textContent).toMatch(/^Cut the deck\./);
      act(() => {
        fireEvent.keyDown(section, { key: "d" });
      });
      // The card that would have come next did not.
      expect(faceUp(container)).not.toBe(projects[1].title);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("the squeeze", () => {
  it("lifts the top card's corner while it is held, and does not draw it", () => {
    vi.useFakeTimers();
    try {
      const { container } = renderIndex();
      const top = container.querySelector(".deck-pile .pcard.is-top") as HTMLElement;
      // The corner shows the next card's own index.
      expect(top.querySelector(".pcard-peel .pcard-rank")?.textContent).toBe(projectNumber(projects[1].slug));
      act(() => {
        fireEvent.pointerDown(top, { button: 0, clientX: 10, clientY: 10 });
      });
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(top).toHaveClass("is-squeezed");
      act(() => {
        fireEvent.pointerUp(window);
        fireEvent.click(top);
      });
      expect(top).not.toHaveClass("is-squeezed");
      expect(faceUp(container)).toBe(projects[0].title);
      // A quick press still draws.
      act(() => {
        fireEvent.pointerDown(top, { button: 0, clientX: 10, clientY: 10 });
        fireEvent.pointerUp(window);
        fireEvent.click(top);
      });
      expect(faceUp(container)).toBe(projects[1].title);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("the win", () => {
  it("bounces each card lower than the last time, and lets it leave either side", () => {
    let f = { x: 0, y: 0, vx: 300, vy: 0 };
    const floor = 500;
    const peaks: number[] = [];
    let rising = false;
    let top = Infinity;
    for (let i = 0; i < 600; i++) {
      const next = stepFlier(f, 1 / 120, floor);
      expect(next.y).toBeLessThanOrEqual(floor);
      if (next.vy < 0) {
        rising = true;
        top = Math.min(top, next.y);
      } else if (rising) {
        peaks.push(top);
        rising = false;
        top = Infinity;
      }
      f = next;
    }
    // The first few bounces, while they are still bounces worth the name.
    expect(peaks.length).toBeGreaterThan(3);
    for (let i = 1; i < 4; i++) expect(peaks[i]).toBeGreaterThan(peaks[i - 1]);
    expect(gone({ x: 1500, y: 0, vx: 1, vy: 0 }, 200, 1440)).toBe(true);
    expect(gone({ x: -201, y: 0, vx: -1, vy: 0 }, 200, 1440)).toBe(true);
    expect(gone({ x: 100, y: 0, vx: 1, vy: 0 }, 200, 1440)).toBe(false);
  });
});
