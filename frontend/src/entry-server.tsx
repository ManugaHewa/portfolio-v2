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
 * Build-time rendering for scripts/prerender.mjs. Each render must equal
 * the browser's first render, so browser-only branches wait for hydration.
 */
export function renderHome(): { html: string; projects: ProjectSummary[] } {
  // The list the API serves (CI compares them), so the live fetch changes nothing.
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

/** Every project page (/work/<slug>/) in page order, with neighbour links; prerender.mjs adds the head. */
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
