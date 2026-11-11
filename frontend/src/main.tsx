import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import type { ProjectSummary } from "./types";
import "./styles/index.css";

const root = document.getElementById("root")!;

// The project list the build prerendered with, written into the page beside
// the HTML. Hydration has to start from exactly the same data.
function prerenderedProjects(): ProjectSummary[] | undefined {
  const data = document.getElementById("initial-projects")?.textContent;
  if (!data) return undefined;
  try {
    return JSON.parse(data) as ProjectSummary[];
  } catch {
    return undefined;
  }
}

const app = (
  <React.StrictMode>
    <App initialProjects={prerenderedProjects()} />
  </React.StrictMode>
);

// Built pages arrive prerendered (scripts/prerender.mjs) and are hydrated in
// place; the dev server serves an empty root, which is rendered from scratch.
if (root.hasChildNodes()) {
  ReactDOM.hydrateRoot(root, app);
} else {
  ReactDOM.createRoot(root).render(app);
}
