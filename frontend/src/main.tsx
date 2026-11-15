import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import type { ProjectSummary } from "./types";
import "./styles/index.css";

const root = document.getElementById("root")!;

// The list the prerender used, embedded in the page, so hydration starts from the same data.
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

// JS is running: disable base.css's 3 s [data-reveal] fail-safe before hydrating.
document.documentElement.classList.add("js");

// Built pages are prerendered and hydrated; the dev server renders an empty root.
if (root.hasChildNodes()) {
  ReactDOM.hydrateRoot(root, app);
} else {
  ReactDOM.createRoot(root).render(app);
}
