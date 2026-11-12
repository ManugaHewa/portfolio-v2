import { render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { STATEMENT, Statement } from "../components/Statement";
import { REDUCED, Wrap, installMatchMedia } from "./motion/helpers";

let media: ReturnType<typeof installMatchMedia> | null = null;
afterEach(() => {
  media?.restore();
  media = null;
});

describe("Statement", () => {
  it("prerenders the paragraph as plain text, at full colour", () => {
    const html = renderToString(
      <Wrap>
        <Statement />
      </Wrap>,
    );
    const host = document.createElement("div");
    host.innerHTML = html;
    const p = host.querySelector(".statement-text")!;
    expect(p.textContent).toBe(STATEMENT);
    expect(p.querySelector("span")).toBeNull();
  });

  it("splits into words that read in with the scroll, keeping the same text", () => {
    media = installMatchMedia([]);
    const { container } = render(
      <Wrap>
        <Statement />
      </Wrap>,
    );
    const p = container.querySelector(".statement-text")!;
    expect(p.querySelectorAll("span").length).toBe(STATEMENT.split(/\s+/).length);
    expect(p.textContent).toBe(STATEMENT);
  });

  it("stays plain text under reduced motion", () => {
    media = installMatchMedia([REDUCED]);
    const { container } = render(
      <Wrap>
        <Statement />
      </Wrap>,
    );
    expect(container.querySelector(".statement-text span")).toBeNull();
  });

  it("keeps the copy free of em dashes", () => {
    expect(STATEMENT).not.toContain("—");
  });
});
