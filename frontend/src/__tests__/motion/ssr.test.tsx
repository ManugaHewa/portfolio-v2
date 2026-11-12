import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HeroName,
  IndexRail,
  Magnetic,
  Marquee,
  Odometer,
  PauseMotionToggle,
  Reveal,
  ScrollProgress,
  Scramble,
  SectionHead,
  SplitTitle,
  TextLoop,
} from "../../motion";
import { Wrap, find } from "./helpers";

/*
 * The page is prerendered, so what the server writes is what crawlers, link
 * previews and visitors without JavaScript read, and React's hydration
 * expects the browser's first render to match it exactly.
 */

const BUILDS = ["web apps", "mobile apps", "APIs", "machine-learning tools"];
const SR = "web apps, mobile apps, APIs and machine-learning tools.";

function serverDom(node: React.ReactNode): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = renderToString(<Wrap>{node}</Wrap>);
  return host;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("server output carries the finished text", () => {
  it("SplitTitle: the whole sentence, one word per mask, real spaces between", () => {
    const dom = serverDom(<SplitTitle as="h2" id="t" text="How the projects reach this page" />);
    const h2 = find(dom, "h2#t");
    expect(h2.textContent).toBe("How the projects reach this page");
    const words = h2.querySelectorAll(".split-mask > .split-word[data-reveal]");
    expect(words).toHaveLength(6);
    // Hidden below the mask until in view; data-reveal is what un-hides it
    // without JavaScript and under reduced motion.
    expect((words[0] as HTMLElement).style.transform).toContain("translateY(120%)");
  });

  it("SectionHead: an h2 and the intro", () => {
    const dom = serverDom(<SectionHead titleId="work-heading" title="Case studies" intro="What each was for." />);
    expect(find(dom, "h2#work-heading").textContent).toBe("Case studies");
    expect(find(dom, "p.section-intro").textContent).toBe("What each was for.");
  });

  it("HeroName: one h1 with the name, no inline hiding", () => {
    const dom = serverDom(<HeroName id="hero-name" text="Manuga Hewa Pathirana" />);
    const h1 = dom.querySelectorAll("h1");
    expect(h1).toHaveLength(1);
    expect(h1[0].textContent).toBe("Manuga Hewa Pathirana");
    expect(h1[0].querySelectorAll(".hero-name-word")).toHaveLength(3);
    // CSS-only: nothing a failed script could leave hidden.
    expect(h1[0].querySelector("[data-reveal]")).toBeNull();
    expect(h1[0].innerHTML).not.toContain("opacity");
  });

  it("Scramble: the final text, once", () => {
    const text = "Milton, Ontario · 43.52° N, 79.88° W";
    const dom = serverDom(<Scramble text={text} className="mono" />);
    expect(dom.textContent).toBe(text);
    expect(dom.querySelector(".scramble-out")).toBeNull();
  });

  it("Odometer: the real digits, plus the screen reader copy", () => {
    const dom = serverDom(<Odometer value={13} className="readout-num" />);
    expect(find(dom, ".odometer-digits").textContent).toBe("13");
    expect(find(dom, ".odometer-digits").getAttribute("aria-hidden")).toBe("true");
    expect(find(dom, ".visually-hidden").textContent).toBe("13");
    // No reel faces in the crawled text.
    expect(dom.textContent).not.toContain("0123456789");
  });

  it("TextLoop: the first word visible, the full sentence for screen readers", () => {
    const dom = serverDom(<TextLoop items={BUILDS} srLabel={SR} />);
    expect(find(dom, ".text-loop-word").textContent).toBe("web apps");
    expect(find(dom, ".visually-hidden").textContent).toBe(SR);
    expect(find(dom, ".text-loop-stage").getAttribute("aria-hidden")).toBe("true");
    // The width-holding ghosts carry their words in attributes, not text.
    expect(dom.textContent).toBe("web apps" + SR);
  });

  it("Marquee: one static list, every item once, no toggle yet", () => {
    const items = ["TypeScript", "React", "Node.js"];
    const dom = serverDom(<Marquee items={items} label="Technologies in these case studies" />);
    const lists = dom.querySelectorAll("ul");
    expect(lists).toHaveLength(1);
    expect(lists[0].getAttribute("aria-label")).toBe("Technologies in these case studies");
    expect(find(dom, ".marquee").className).not.toContain("is-running");
    expect(dom.querySelector("button")).toBeNull();
  });

  it("ScrollProgress and the rail marker render nothing until hydrated", () => {
    const dom = serverDom(
      <>
        <ScrollProgress />
        <IndexRail sections={[{ id: "a", label: "A" }, { id: "b", label: "B" }]} />
      </>,
    );
    expect(dom.querySelector(".scroll-progress")).toBeNull();
    expect(dom.querySelector(".index-rail-marker")).toBeNull();
    // Evenly spaced ticks, the no-JavaScript layout.
    const items = dom.querySelectorAll<HTMLElement>(".index-rail-item");
    expect(items[0].style.getPropertyValue("--pos")).toBe("0");
    expect(items[1].style.getPropertyValue("--pos")).toBe("1");
  });
});

describe("hydration", () => {
  it("the browser's first render matches the server's for every primitive", async () => {
    const tree = (
      <Wrap>
        <ScrollProgress />
        <IndexRail sections={[{ id: "a", label: "A" }, { id: "b", label: "B" }]} />
        <PauseMotionToggle />
        <HeroName id="hero-name" text="Manuga Hewa Pathirana" />
        <Scramble text="content/projects.ts" trigger="mount" />
        <TextLoop items={BUILDS} srLabel={SR} />
        <SplitTitle as="h2" text="Selected work" />
        <Odometer value={13} />
        <Reveal as="div" index={1}>
          row
        </Reveal>
        <Magnetic>
          <a href="#work-index">See the work</a>
        </Magnetic>
        <Marquee items={["TypeScript", "React"]} label="Technologies" />
      </Wrap>
    );

    const host = document.createElement("div");
    host.innerHTML = renderToString(tree);
    document.body.appendChild(host);

    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const recoverable: unknown[] = [];
    await act(async () => {
      hydrateRoot(host, tree, { onRecoverableError: (e) => recoverable.push(e) });
    });

    expect(recoverable).toEqual([]);
    const hydrationErrors = errors.mock.calls.filter((args) =>
      args.some((a) => typeof a === "string" && /hydrat|did not match|server/i.test(a)),
    );
    expect(hydrationErrors).toEqual([]);
    // And after hydration the browser-only parts arrive.
    expect(host.querySelector(".scroll-progress")).not.toBeNull();
    expect(host.querySelector(".index-rail-marker")).not.toBeNull();
  });
});
