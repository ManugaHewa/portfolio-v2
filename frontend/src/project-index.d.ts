// The module vite.config.ts generates from content/projects.ts (the
// projectIndex plugin): only the fields src/stats.ts derives the page's
// numbers from, so the case studies' full copy stays out of the bundle.
declare module "virtual:project-index" {
  import type { ProjectContent } from "../../content/projects";

  export type ProjectIndexEntry = Pick<
    ProjectContent,
    "slug" | "title" | "tier" | "category" | "status" | "stack"
  >;

  /** Every project, in content order. */
  export const PROJECTS: ReadonlyArray<ProjectIndexEntry>;
}
