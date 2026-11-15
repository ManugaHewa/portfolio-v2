/**
 * Every number the page shows about itself, derived from the data. Projects
 * come from content/projects.ts via `virtual:project-index` (vite.config.ts),
 * a slim copy, so the case studies' text stays out of the main bundle.
 */
import { PROJECTS } from "virtual:project-index";
import { CATEGORIES, SKILLS } from "./skills";
import { ALSO_ON_GITHUB } from "./repositories";

const caseStudies = PROJECTS.filter((p) => p.tier === 1);
const otherProjects = PROJECTS.filter((p) => p.tier !== 1);

export const STATS = {
  /** Projects on this page: case studies and other work together. */
  projects: PROJECTS.length,
  caseStudies: caseStudies.length,
  otherProjects: otherProjects.length,
  /** The repository rows under Other work, which are not projects. */
  repositories: ALSO_ON_GITHUB.length,
  skills: SKILLS.length,
  /** Skill groups, one per category. */
  groups: CATEGORIES.length,
} as const;

/** Slug, title, tier and stack size per project, in page order (case studies first). */
export const PROJECT_INDEX: ReadonlyArray<{ slug: string; title: string; tier: number; stackSize: number }> = [
  ...caseStudies,
  ...otherProjects,
].map(({ slug, title, tier, stack }) => ({ slug, title, tier, stackSize: stack.length }));

const NUMBERS = new Map(PROJECT_INDEX.map((p, i) => [p.slug, String(i + 1).padStart(2, "0")]));

/** A project's two-digit number in page order; "" for an unknown slug. */
export function projectNumber(slug: string): string {
  return NUMBERS.get(slug) ?? "";
}

/** Every technology in the case studies' stacks, once, in first-seen order. */
export const TECH_BAND: string[] = [...new Set(caseStudies.flatMap((p) => p.stack))];
