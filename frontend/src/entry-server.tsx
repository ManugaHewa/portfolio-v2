import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import App from "./App";
import { PrivacyPage } from "./components/PrivacyPage";
import { NotFoundPage } from "./components/NotFoundPage";
import { projectSummaries } from "../../content/projects";
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
