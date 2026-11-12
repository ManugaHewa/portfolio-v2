import { render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { HeroName } from "../motion";
import { pressure } from "../motion/HeroName";
import { FINE, REDUCED, Wrap, installMatchMedia } from "./motion/helpers";

const NAME = "Manuga Hewa Pathirana";
let media: ReturnType<typeof installMatchMedia> | null = null;
afterEach(() => {
  media?.restore();
  media = null;
});

describe("HeroName pressure", () => {
  it("is full under the cursor and fades to nothing at its reach", () => {
    expect(pressure(0)).toBe(1);
    expect(pressure(110)).toBeCloseTo(0.5, 5);
    expect(pressure(220)).toBe(0);
    expect(pressure(500)).toBe(0);
    expect(pressure(50)).toBeGreaterThan(pressure(100));
  });

  it("prerenders whole words, never letters", () => {
    const html = renderToString(
      <Wrap>
        <HeroName id="hero-name" text={NAME} />
      </Wrap>,
    );
    expect(html).not.toContain("hero-name-char");
  });

  it("splits into letters for a mouse with motion allowed, keeping the name as its text", () => {
    media = installMatchMedia([FINE]);
    const { container } = render(
      <Wrap>
        <HeroName id="hero-name" text={NAME} />
      </Wrap>,
    );
    const h1 = container.querySelector("h1")!;
    expect(h1.querySelectorAll(".hero-name-char")).toHaveLength(NAME.replace(/\s/g, "").length);
    expect(h1.textContent).toBe(NAME);
  });

  it("stays whole words for touch or under reduced motion", () => {
    media = installMatchMedia([]);
    const touch = render(
      <Wrap>
        <HeroName text={NAME} />
      </Wrap>,
    );
    expect(touch.container.querySelector(".hero-name-char")).toBeNull();
    touch.unmount();
    media.set([FINE, REDUCED]);
    const reduced = render(
      <Wrap>
        <HeroName text={NAME} />
      </Wrap>,
    );
    expect(reduced.container.querySelector(".hero-name-char")).toBeNull();
  });
});
