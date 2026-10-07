import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { act } from "@testing-library/react";
import { it, expect, vi } from "vitest";

// Before anything renders: framer-motion reads the reduced-motion preference
// once, on first use, and keeps it for the life of the module. Its own file,
// so no earlier test in the same module graph can have read it first.
window.matchMedia = ((query: string) => ({
  matches: query.includes("reduce"),
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;

vi.mock("../api", async () => {
  const { projectSummaries } = await import("../../../content/projects");
  return {
    api: {
      getProjects: () => Promise.resolve(projectSummaries()),
      getProject: () => Promise.resolve(null),
      sendContactMessage: () => Promise.resolve({ status: "received" }),
    },
  };
});

it("hydrates for a visitor who prefers reduced motion, then switches to the static version", async () => {
  const { default: App } = await import("../App");
  const { renderHome } = await import("../entry-server");

  // The build cannot know the visitor's setting, so it renders the animated
  // version. The reduced one may only take over after hydration, or React
  // would throw the server HTML away and render the page again.
  // (The useLayoutEffect warning react-dom/server prints here is jsdom-only;
  // see onServer in prerender.test.tsx.)
  const serverLog = vi.spyOn(console, "error").mockImplementation(() => {});
  const { html, projects } = renderHome();
  serverLog.mockRestore();
  expect(html).not.toContain("statement-static");

  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const recoverable: unknown[] = [];

  await act(async () => {
    hydrateRoot(
      container,
      <StrictMode>
        <App initialProjects={projects} />
      </StrictMode>,
      { onRecoverableError: (e) => recoverable.push(e) },
    );
  });

  expect(recoverable).toEqual([]);
  expect(errors.mock.calls.map((c) => String(c[0])).filter((e) => /hydrat|did not match/i.test(e))).toEqual([]);
  expect(container.querySelector(".statement-static")).not.toBeNull();
});
