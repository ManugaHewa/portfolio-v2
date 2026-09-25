import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import App from "../App";

vi.mock("../api", () => ({
  api: {
    getProjects: () => Promise.resolve([]),
    getProject: () => Promise.resolve(null),
    sendContactMessage: () => Promise.resolve({ id: "1", status: "received" }),
  },
}));

describe("page landmarks", () => {
  it("offers a skip link pointing at the main landmark", async () => {
    // The stylesheet carried .skip-link from the previous site, but the React
    // rebuild never rendered it, so keyboard users had to tab the whole nav on
    // every load. This pins the markup to the styles.
    await act(async () => { render(<App />); });

    const skip = screen.getByRole("link", { name: /skip to content/i });
    expect(skip).toHaveAttribute("href", "#main");
    expect(document.querySelector("main")).toHaveAttribute("id", "main");
  });

  it("gives every section a heading that names it", async () => {
    await act(async () => { render(<App />); });
    // "about" is gone: the six capability cards were merged into #contact,
    // so the page is Work / Skills / Contact.
    for (const id of ["skills", "projects", "contact"]) {
      const section = document.getElementById(id);
      expect(section, `#${id} should exist`).not.toBeNull();
      const labelledBy = section?.getAttribute("aria-labelledby");
      expect(labelledBy, `#${id} should be labelled`).toBeTruthy();
      expect(document.getElementById(labelledBy!)).not.toBeNull();
    }
  });
});
