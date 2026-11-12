import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { act } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import App from "../App";
import { PrivacyPage } from "../components/PrivacyPage";
import { renderHome, renderNotFound, renderPrivacy } from "../entry-server";
import { PROJECTS } from "../../../content/projects";
import { STATS } from "../stats";

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

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

/**
 * Runs a server render and fails on anything it logs, except one warning that
 * only exists here: jsdom provides a `window`, so useIsomorphicLayoutEffect
 * (and framer-motion's own) pick useLayoutEffect, which react-dom/server warns
 * about. The real build renders in Node, where there is no window and no
 * warning.
 */
function onServer<T>(render: () => T): T {
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    return render();
  } finally {
    const unexpected = logged.mock.calls
      .map((c) => String(c[0]))
      .filter((message) => !message.includes("useLayoutEffect does nothing on the server"));
    logged.mockRestore();
    expect(unexpected).toEqual([]);
  }
}

/** Puts server HTML in the page, hydrates it, and returns every console.error React raised. */
async function hydrate(html: string, element: React.ReactElement) {
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const recoverable: unknown[] = [];

  await act(async () => {
    hydrateRoot(container, element, { onRecoverableError: (e) => recoverable.push(e) });
  });

  return { container, errors: errors.mock.calls.map((c) => String(c[0])), recoverable };
}

describe("the prerendered home page", () => {
  it("contains the text a crawler needs, without running any JavaScript", () => {
    const doc = new DOMParser().parseFromString(onServer(renderHome).html, "text/html");
    const text = doc.body.textContent ?? "";

    // The name is the only h1. HeroName splits it into word spans with real
    // spaces between them, so its text still reads as the name.
    expect(doc.querySelectorAll("h1")).toHaveLength(1);
    expect(doc.querySelector("h1")?.textContent).toBe("Manuga Hewa Pathirana");
    for (const project of PROJECTS) {
      expect(text, project.slug).toContain(project.title);
    }
    // Each case study carries its problem (the work index row, when it has
    // one) and what it is (its card); the outcomes are in the case study
    // the card opens. Each Other work row carries its one-line summary.
    for (const project of PROJECTS.filter((p) => p.tier === 1)) {
      if (project.problem) expect(text, `${project.slug} problem`).toContain(project.problem);
      expect(text, `${project.slug} subtitle`).toContain(project.subtitle);
    }
    for (const project of PROJECTS.filter((p) => p.tier !== 1)) {
      expect(text, `${project.slug} subtitle`).toContain(project.subtitle);
    }
    // The work index's counts are in the HTML as the real numbers, both as
    // the visible digits and as the screen reader copy.
    const readouts = [...doc.querySelectorAll("#work-index .odometer")];
    expect(readouts.map((o) => o.querySelector(".visually-hidden")?.textContent)).toEqual([
      String(STATS.projects),
      String(STATS.caseStudies),
      String(STATS.repositories),
    ]);
    expect(readouts.map((o) => o.querySelector(".odometer-digits")?.textContent)).toEqual([
      String(STATS.projects),
      String(STATS.caseStudies),
      String(STATS.repositories),
    ]);
  });

  it("hydrates without React discarding the server HTML", async () => {
    const { html, projects } = onServer(renderHome);
    const { container, errors, recoverable } = await hydrate(
      html,
      <StrictMode>
        <App initialProjects={projects} />
      </StrictMode>,
    );

    expect(recoverable).toEqual([]);
    expect(errors.filter((e) => /hydrat|did not match/i.test(e))).toEqual([]);
    // The cards and rows were in the HTML and are still there after
    // hydration, each under the id the work index links to.
    for (const project of PROJECTS) {
      const id = project.tier === 1 ? `case-${project.slug}` : `other-${project.slug}`;
      expect(container.querySelector(`[id="${id}"]`), id).not.toBeNull();
    }
    expect(container.querySelectorAll(".case-card")).toHaveLength(
      PROJECTS.filter((p) => p.tier === 1).length,
    );
    // Motion is allowed here (jsdom's matchMedia matches nothing), so the
    // animated versions took over after hydration: the tech band runs.
    expect(container.querySelector(".marquee.is-running")).not.toBeNull();
  });
});

describe("the other prerendered pages", () => {
  it("hydrates the privacy page cleanly", async () => {
    const { errors, recoverable } = await hydrate(
      onServer(renderPrivacy),
      <StrictMode>
        <PrivacyPage />
      </StrictMode>,
    );
    expect(recoverable).toEqual([]);
    expect(errors.filter((e) => /hydrat|did not match/i.test(e))).toEqual([]);
  });

  it("renders a 404 page with its heading and a way back", () => {
    const doc = new DOMParser().parseFromString(onServer(renderNotFound), "text/html");
    expect(doc.querySelector("h1")?.textContent).toBe("Page not found");
    expect(doc.querySelector('a[href="/"]')).not.toBeNull();
  });
});
