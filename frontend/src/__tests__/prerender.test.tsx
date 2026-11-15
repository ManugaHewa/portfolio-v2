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
 * Server render that fails on any log, except the useLayoutEffect warning,
 * which only appears because jsdom provides a window.
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

/** Puts server HTML in the page, hydrates, and returns React's console.errors. */
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

    // One h1, the name; HeroName's word spans keep real spaces.
    expect(doc.querySelectorAll("h1")).toHaveLength(1);
    expect(doc.querySelector("h1")?.textContent).toBe("Manuga Hewa Pathirana");
    for (const project of PROJECTS) {
      expect(text, project.slug).toContain(project.title);
    }
    // Every project is linked from the deck's list; the face-up card names the first.
    for (const project of PROJECTS) {
      const link = doc.querySelector(`.deck-list a[href="/work/${project.slug}/"]`);
      expect(link?.textContent, project.slug).toContain(project.title);
    }
    const first = PROJECTS.find((p) => p.tier === 1)!;
    expect(doc.querySelector(".pcard.is-up")?.textContent).toContain(first.subtitle);
    // Counts are real numbers in the HTML, visible and for screen readers.
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
    // The deck survives hydration: face-up card, face-down deck, full list.
    const first = PROJECTS.find((p) => p.tier === 1)!;
    expect(container.querySelector(`.pcard.is-up[id="case-${first.slug}"]`)).not.toBeNull();
    expect(container.querySelectorAll(".deck-pile .pcard")).toHaveLength(PROJECTS.length - 1);
    expect(container.querySelectorAll(".deck-list ol a")).toHaveLength(PROJECTS.length);
    // Motion is allowed here, so the tech band runs after hydration.
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
