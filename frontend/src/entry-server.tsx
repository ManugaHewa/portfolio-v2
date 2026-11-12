import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import App from "./App";
import { PrivacyPage } from "./components/PrivacyPage";
import { NotFoundPage } from "./components/NotFoundPage";
import { CaseStudyPage } from "./components/CaseStudyPage";
import { PROJECTS, projectSummaries } from "../../content/projects";
import { PROJECT_INDEX } from "./stats";
import type { ProjectSummary } from "./types";

/**
 * Build-time rendering, run once by scripts/prerender.mjs after `vite build`.
 * The output goes into dist/*.html so crawlers and link previews get the real
 * text without running JavaScript; the browser then hydrates the same tree.
 *
 * Every render here must equal the browser's first render, which is why the
 * components that branch on browser-only facts wait for useHydrated().
 */
export function renderHome(): { html: string; projects: ProjectSummary[] } {
  // The same list the API serves (CI compares the two), so the live fetch
  // after hydration changes nothing on screen.
  const projects = projectSummaries() as ProjectSummary[];
  const html = renderToString(
    <StrictMode>
      <App initialProjects={projects} />
    </StrictMode>,
  );
  return { html, projects };
}

export function renderPrivacy(): string {
  return renderToString(
    <StrictMode>
      <PrivacyPage />
    </StrictMode>,
  );
}

export function renderNotFound(): string {
  return renderToString(<NotFoundPage />);
}

/**
 * Every project's page (/work/<slug>/), in page order, each linking to its
 * neighbours. The head is written around it by prerender.mjs from the
 * title and subtitle returned here.
 */
export function renderCaseStudies(): Array<{ slug: string; title: string; subtitle: string; html: string }> {
  const ordered = PROJECT_INDEX.map((entry) => PROJECTS.find((p) => p.slug === entry.slug)).filter(
    (p): p is (typeof PROJECTS)[number] => p !== undefined,
  );
  return ordered.map((p, i) => ({
    slug: p.slug,
    title: p.title,
    subtitle: p.subtitle,
    html: renderToString(<CaseStudyPage project={p} previous={ordered[i - 1]} next={ordered[i + 1]} />),
  }));
}
