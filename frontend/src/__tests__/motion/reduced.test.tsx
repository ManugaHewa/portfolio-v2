import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Marquee, Odometer, Reveal, Scramble, SplitTitle, TextLoop, TiltSurface } from "../../motion";
import { FINE, REDUCED, Wrap, find, installMatchMedia } from "./helpers";

/*
 * prefers-reduced-motion: reduce (SPEC.md section 4): text appears in place,
 * numbers show their final value, nothing loops or scrambles, the marquee is
 * a static wrapped list and cursor effects are off.
 */

const BUILDS = ["web apps", "mobile apps", "APIs", "machine-learning tools"];

let media: ReturnType<typeof installMatchMedia>;

beforeEach(() => {
  media = installMatchMedia([REDUCED, FINE]);
});

afterEach(() => {
  media.restore();
  vi.useRealTimers();
});

describe("under reduced motion", () => {
  it("Odometer keeps the plain final digits and never builds reels", () => {
    const { container } = render(
      <Wrap>
        <Odometer value={13} />
      </Wrap>,
    );
    expect(find(container, ".odometer-digits").textContent).toBe("13");
    expect(container.querySelector(".odometer-slot")).toBeNull();
  });

  it("TextLoop shows the first word and never rotates", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const { container } = render(
      <Wrap>
        <TextLoop items={BUILDS} interval={1000} srLabel="all four" />
      </Wrap>,
    );
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    const words = [...container.querySelectorAll(".text-loop-word")].map((w) => w.textContent);
    expect(words).toEqual(["web apps"]);
    expect(screen.getByText("all four")).toBeInTheDocument();
  });

  it("Scramble shows the final text and never draws frames", async () => {
    const { container } = render(
      <Wrap>
        <Scramble text="backend/prisma/seed.ts" trigger="mount" />
      </Wrap>,
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(container.querySelector(".scramble-out")).toBeNull();
    expect(container.textContent).toBe("backend/prisma/seed.ts");
  });

  it("SplitTitle and Reveal land on their finished values", async () => {
    const { container } = render(
      <Wrap>
        <SplitTitle as="h2" text="Get in touch" />
        <Reveal index={4}>row</Reveal>
      </Wrap>,
    );
    const words = [...container.querySelectorAll<HTMLElement>(".split-word")];
    const row = find(container, "[data-reveal]:not(.split-word)");
    await waitFor(() => {
      for (const w of words) expect(w.style.transform).toMatch(/^(none|translateY\(0%\))?$/);
      expect(row.style.opacity).toBe("1");
    });
  });

  it("Marquee is one static list with no duplicate and no toggle", () => {
    const { container } = render(
      <Wrap>
        <Marquee items={["TypeScript", "React"]} label="Technologies" />
      </Wrap>,
    );
    expect(container.querySelectorAll("ul")).toHaveLength(1);
    expect(find(container, ".marquee").className).not.toContain("is-running");
    expect(container.querySelector("button")).toBeNull();
  });

  it("TiltSurface stays off, even on a fine pointer", () => {
    const { container } = render(
      <Wrap>
        <TiltSurface visual={<figure>f</figure>}>
          <p>content</p>
        </TiltSurface>
      </Wrap>,
    );
    expect(find(container, ".tilt-surface").hasAttribute("data-tilt")).toBe(false);
  });
});

describe("with motion allowed (for contrast)", () => {
  it("Odometer builds reels but keeps the number as its text", () => {
    media.set([FINE]);
    const { container } = render(
      <Wrap>
        <Odometer value={13} />
      </Wrap>,
    );
    expect(container.querySelectorAll(".odometer-slot")).toHaveLength(2);
    expect(find(container, ".odometer-digits").textContent).toBe("13");
    expect(find(container, ".visually-hidden").textContent).toBe("13");
  });

  it("TiltSurface switches on for a fine pointer", () => {
    media.set([FINE]);
    const { container } = render(
      <Wrap>
        <TiltSurface visual={<figure>f</figure>}>
          <p>content</p>
        </TiltSurface>
      </Wrap>,
    );
    expect(find(container, ".tilt-surface").getAttribute("data-tilt")).toBe("on");
  });

  it("switching reduced motion on mid-visit stops the marquee", () => {
    media.set([]);
    const { container } = render(
      <Wrap>
        <Marquee items={["TypeScript", "React"]} label="Technologies" />
      </Wrap>,
    );
    expect(find(container, ".marquee").className).toContain("is-running");
    act(() => media.set([REDUCED]));
    expect(find(container, ".marquee").className).not.toContain("is-running");
    expect(container.querySelectorAll("ul")).toHaveLength(1);
  });
});
