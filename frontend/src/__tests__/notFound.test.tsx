import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NotFoundPage } from "../components/NotFoundPage";

describe("the 404", () => {
  const doc = new DOMParser().parseFromString(renderToString(<NotFoundPage />), "text/html");

  it("says what happened in its one h1", () => {
    expect(doc.querySelectorAll("h1")).toHaveLength(1);
    expect(doc.querySelector("h1")?.textContent).toBe("Page not found");
  });

  it("has a lost card that leads back to the deck, its drawing hidden from assistive technology", () => {
    const card = doc.querySelector<HTMLAnchorElement>("a.lost-card")!;
    expect(card.getAttribute("href")).toBe("/#work-index");
    expect(card.querySelector(".lost-card-inner")?.getAttribute("aria-hidden")).toBe("true");
    expect(card.textContent).toContain("Back to the deck of projects");
  });

  it("needs no script", () => {
    expect(renderToString(<NotFoundPage />)).not.toContain("<script");
  });
});
