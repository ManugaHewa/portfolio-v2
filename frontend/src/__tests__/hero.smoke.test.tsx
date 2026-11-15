import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Hero } from "../components/Hero";
import { TechBand } from "../components/TechBand";
import { PIN_QUERY } from "../motion";
import { TECH_BAND } from "../stats";
import { projectSummaries } from "../../../content/projects";
import type { ProjectSummary } from "../types";
import { Wrap, installMatchMedia } from "./motion/helpers";

const all = projectSummaries() as ProjectSummary[];
const projects = [...all.filter((p) => p.tier === 1), ...all.filter((p) => p.tier !== 1)];

const renderHero = () =>
  render(
    <Wrap>
      <Hero projects={projects} onOpen={() => {}} />
    </Wrap>,
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Hero", () => {
  it("makes the name the page's one h1", () => {
    // The h1 is the name, which people search for.
    renderHero();
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("Manuga Hewa Pathirana");
  });

  it("holds the stage and the work index in one #top container", () => {
    const { container } = renderHero();
    const top = container.querySelector("#top");
    expect(top).not.toBeNull();
    expect(top!.querySelector(":scope > .hero-stage")).not.toBeNull();
    expect(top!.querySelector(":scope > #work-index")).not.toBeNull();
  });

  it("links the two actions to the work index and to contact", () => {
    renderHero();
    expect(screen.getByRole("link", { name: "See the work" })).toHaveAttribute("href", "#work-index");
    expect(screen.getByRole("link", { name: "Get in touch" })).toHaveAttribute("href", "#contact");
    for (const name of ["GitHub", "LinkedIn", "Email"]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
  });

  it("gives screen readers the whole 'I build' sentence once, not the rotating word", () => {
    const { container } = renderHero();
    const lede = container.querySelector(".hero-lede")!;
    expect(lede.querySelector(".text-loop-stage")).toHaveAttribute("aria-hidden", "true");
    expect(lede.querySelector(".visually-hidden")).toHaveTextContent(
      "web apps, mobile apps, APIs and machine-learning tools.",
    );
    // Screen readers hear the lead-in and the hidden sentence, nothing from the rotating word.
    const heard = Array.from(lede.childNodes)
      .map((n) => (n instanceof Element ? n.querySelector(".visually-hidden")?.textContent : n.textContent))
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    expect(heard).toBe("Full-stack developer. I build web apps, mobile apps, APIs and machine-learning tools.");
  });

  it("claims self-hosting for this site only", () => {
    // The second line scopes self-hosting to this site.
    const { container } = renderHero();
    expect(container.querySelector(".hero-lede-2")).toHaveTextContent(
      "Mostly in TypeScript, React, Node.js and Python. I host this site on my own server.",
    );
  });

  it("prerenders the copy at rest, with the place label's final text", () => {
    // Nothing in the hero's server HTML is hidden or offset.
    const html = renderToString(
      <Wrap>
        <Hero projects={projects} onOpen={() => {}} />
      </Wrap>,
    );
    expect(html).toContain("Milton, Ontario · 43.52° N, 79.88° W");
    expect(html).toContain("Manuga");
    expect(html).not.toMatch(/hero-copy[^>]*opacity:\s*0/);
    expect(html).toContain("hero-wheel-stage");
  });

  it("keeps the wheel and its still decorative, with Spin on its rim", () => {
    const { container } = renderHero();
    const wheel = container.querySelector(".hero-wheel")!;
    expect(wheel.querySelector(".hero-still")).toHaveAttribute("aria-hidden", "true");
    // The plate is prerendered, and is the column's only thing a screen reader meets.
    expect(wheel.querySelector(".spin-plaque")).toHaveTextContent("Place your bets");
    expect(screen.getByRole("button", { name: "Spin the wheel" })).toBeInTheDocument();
  });

  it("scrolls the hero back to its start when keyboard focus lands in the faded copy", () => {
    const media = installMatchMedia([PIN_QUERY]);
    const scrollTo = vi.fn();
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    try {
      const { container } = renderHero();
      const copy = container.querySelector<HTMLElement>(".hero-copy")!;
      const link = screen.getByRole("link", { name: "Get in touch" });
      // jsdom keeps the hand-off at 0: focus must not move the page, but must hold the copy visible.
      act(() => link.focus());
      expect(copy).toHaveClass("is-focused");
      expect(scrollTo).not.toHaveBeenCalled();
      act(() => link.blur());
      expect(copy).not.toHaveClass("is-focused");
    } finally {
      media.restore();
    }
  });

  it("unmounts cleanly", () => {
    const { unmount, container } = renderHero();
    unmount();
    expect(container.innerHTML).toBe("");
  });
});

describe("TechBand", () => {
  it("lists every technology once, in one labelled list", () => {
    render(
      <Wrap>
        <TechBand />
      </Wrap>,
    );
    const list = screen.getByRole("list", { name: "Technologies in these case studies" });
    const items = Array.from(list.querySelectorAll("li")).map((li) => li.textContent);
    expect(items).toEqual(TECH_BAND);
    expect(new Set(items).size).toBe(items.length);
  });
});
