import { act, fireEvent, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  IndexRail,
  Marquee,
  PauseMotionToggle,
  TextLoop,
  useMediaQuery,
} from "../../motion";
import { reelPosition } from "../../motion/Odometer";
import { scrambleFrame } from "../../motion/Scramble";
import { Wrap, find, installMatchMedia } from "./helpers";

const BUILDS = ["web apps", "mobile apps", "APIs", "machine-learning tools"];

let media: ReturnType<typeof installMatchMedia>;

beforeEach(() => {
  media = installMatchMedia([]);
});

afterEach(() => {
  media.restore();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

const wordsIn = (root: Element) =>
  [...root.querySelectorAll(".text-loop-word")].map((w) => w.textContent);

describe("useMediaQuery", () => {
  it("is false on the first (hydrating) render even when the query matches", async () => {
    media.set(["(min-width: 1100px)"]);
    const seen: boolean[] = [];
    function Probe() {
      const wide = useMediaQuery("(min-width: 1100px)");
      seen.push(wide);
      return <span>{wide ? "wide" : "narrow"}</span>;
    }

    const host = document.createElement("div");
    host.innerHTML = renderToString(<Probe />);
    expect(host.textContent).toBe("narrow");
    document.body.appendChild(host);

    await act(async () => {
      hydrateRoot(host, <Probe />);
    });

    expect(seen[0]).toBe(false);
    expect(seen[seen.length - 1]).toBe(true);
    expect(host.textContent).toBe("wide");
  });

  it("follows the setting when it changes", () => {
    function Probe() {
      return <span>{useMediaQuery("(prefers-reduced-motion: reduce)") ? "reduce" : "full"}</span>;
    }
    render(<Probe />);
    expect(screen.getByText("full")).toBeInTheDocument();
    act(() => media.set(["(prefers-reduced-motion: reduce)"]));
    expect(screen.getByText("reduce")).toBeInTheDocument();
  });
});

describe("TextLoop", () => {
  it("rotates on its interval, and Pause motion holds the current word", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const { container } = render(
      <Wrap>
        <PauseMotionToggle />
        <TextLoop items={BUILDS} interval={1000} srLabel="all four" />
      </Wrap>,
    );
    expect(wordsIn(container)).toEqual(["web apps"]);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(wordsIn(container)).toContain("mobile apps");

    fireEvent.click(screen.getByRole("button", { name: "Pause motion" }));
    expect(screen.getByRole("button", { name: "Pause motion" })).toHaveAttribute("aria-pressed", "true");

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(wordsIn(container)).toContain("mobile apps");
    expect(wordsIn(container)).not.toContain("APIs");
    expect(wordsIn(container)).not.toContain("machine-learning tools");
  });
});

describe("Marquee", () => {
  const items = ["TypeScript", "React", "Node.js"];

  it("runs with an aria-hidden, inert duplicate once hydrated", () => {
    const { container } = render(
      <Wrap>
        <Marquee items={items} label="Technologies in these case studies" />
      </Wrap>,
    );
    expect(find(container, ".marquee").className).toContain("is-running");
    const lists = container.querySelectorAll("ul");
    expect(lists).toHaveLength(2);
    expect(lists[1]).toHaveAttribute("aria-hidden", "true");
    expect((lists[1] as HTMLElement & { inert?: boolean }).inert).toBe(true);
    // One copy for assistive tech.
    expect(screen.getAllByRole("list")).toHaveLength(1);
    expect(screen.getByRole("list", { name: "Technologies in these case studies" })).toBeInTheDocument();
  });

  it("its own Pause toggle returns it to the static list", () => {
    const { container } = render(
      <Wrap>
        <Marquee items={items} label="Technologies" />
      </Wrap>,
    );
    const toggle = screen.getByRole("button", { name: "Pause" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(find(container, ".marquee").className).not.toContain("is-running");
    expect(container.querySelectorAll("ul")).toHaveLength(1);

    fireEvent.click(toggle);
    expect(find(container, ".marquee").className).toContain("is-running");
  });

  it("stops for the header's Pause motion as well", () => {
    const { container } = render(
      <Wrap>
        <PauseMotionToggle />
        <Marquee items={items} label="Technologies" />
      </Wrap>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Pause motion" }));
    expect(find(container, ".marquee").className).not.toContain("is-running");
    expect(container.querySelectorAll("ul")).toHaveLength(1);
  });
});

describe("IndexRail", () => {
  const SECTIONS = [
    { id: "work-index", label: "Work" },
    { id: "pipeline", label: "How it's built" },
    { id: "skills", label: "Skills" },
  ];

  beforeEach(() => {
    // A page much taller than the viewport, scrolled to the top: jsdom
    // reports a scrollHeight of 0, which reads as "at the very bottom".
    Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: 6000 });
  });

  afterEach(() => {
    delete (document.documentElement as { scrollHeight?: number }).scrollHeight;
  });

  function placeSection(id: string, top: number) {
    const el = document.createElement("section");
    el.id = id;
    el.getBoundingClientRect = () => ({ top, bottom: top + 400, left: 0, right: 0, width: 0, height: 400, x: 0, y: top, toJSON() {} }) as DOMRect;
    document.body.appendChild(el);
  }

  it("marks the section that has crossed the reading line with aria-current", () => {
    // The line sits a third of the way down a 768px viewport.
    placeSection("work-index", -600);
    placeSection("pipeline", 120);
    placeSection("skills", 900);

    render(
      <Wrap>
        <IndexRail sections={SECTIONS} />
      </Wrap>,
    );

    const nav = screen.getByRole("navigation", { name: "Section index" });
    const link = (name: string) => screen.getByRole("link", { name });
    expect(nav).toBeInTheDocument();
    expect(link("How it's built")).toHaveAttribute("aria-current", "location");
    expect(link("Work")).not.toHaveAttribute("aria-current");
    expect(link("Skills")).not.toHaveAttribute("aria-current");
    expect(link("Skills")).toHaveAttribute("href", "#skills");
  });

  it("names nothing current above the first section (in the hero)", () => {
    placeSection("work-index", 500);
    placeSection("pipeline", 1500);
    placeSection("skills", 2500);
    render(
      <Wrap>
        <IndexRail sections={SECTIONS} />
      </Wrap>,
    );
    for (const s of SECTIONS) expect(screen.getByRole("link", { name: s.label })).not.toHaveAttribute("aria-current");
  });
});

describe("pure helpers", () => {
  it("reelPosition carries like a mechanical odometer", () => {
    expect(reelPosition(13, 1)).toBe(3);
    expect(reelPosition(13, 10)).toBe(1);
    // The tens reel waits while the units run 0 to 9 ...
    expect(reelPosition(8.5, 10)).toBe(0);
    // ... and turns while the units pass from 9 to 0.
    expect(reelPosition(9.5, 10)).toBeCloseTo(0.5);
    expect(reelPosition(10, 10)).toBe(1);
    expect(reelPosition(9.5, 1)).toBeCloseTo(9.5);
  });

  it("scrambleFrame keeps punctuation and resolves left to right", () => {
    const chars = Array.from("43.52° N");
    const start = scrambleFrame(chars, 0);
    expect(start).toHaveLength(chars.length);
    expect(start[2]).toBe(".");
    expect(start[5]).toBe("°");
    expect(start[6]).toBe(" ");
    expect(start[7]).toMatch(/[A-Z]/);
    expect(start[0]).toMatch(/[0-9]/);
    expect(scrambleFrame(chars, 0.999).slice(0, 7)).toBe("43.52° ");
  });
});
