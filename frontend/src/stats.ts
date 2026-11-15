/**
 * Every number the page shows about itself, derived from the data. Projects
 * come from content/projects.ts via `virtual:project-index` (vite.config.ts),
 * a slim copy, so the case studies' text stays out of the main bundle.
 */
import { PROJECTS } from "virtual:project-index";
import { ALSO_ON_GITHUB } from "./repositories";

/** Page order: case studies first, then other work, each in content order. */
export const pageOrder = <T extends { tier: number }>(list: readonly T[]): T[] => [
  ...list.filter((p) => p.tier === 1),
  ...list.filter((p) => p.tier !== 1),
];

/** Two digits, as project numbers are written. */
export const pad2 = (n: number) => String(n).padStart(2, "0");

const caseStudies = PROJECTS.filter((p) => p.tier === 1);

export const STATS = {
  /** Projects on this page: case studies and other work together. */
  projects: PROJECTS.length,
  caseStudies: caseStudies.length,
  otherProjects: PROJECTS.length - caseStudies.length,
  /** The repository rows under Other work, which are not projects. */
  repositories: ALSO_ON_GITHUB.length,
} as const;

/** Slug, title, tier and stack size per project, in page order. */
export const PROJECT_INDEX: ReadonlyArray<{ slug: string; title: string; tier: number; stackSize: number }> = pageOrder(
  PROJECTS,
).map(({ slug, title, tier, stack }) => ({ slug, title, tier, stackSize: stack.length }));

const NUMBERS = new Map(PROJECT_INDEX.map((p, i) => [p.slug, pad2(i + 1)]));

/** A project's two-digit number in page order; "" for an unknown slug. */
export function projectNumber(slug: string): string {
  return NUMBERS.get(slug) ?? "";
}

/** Every technology in the case studies' stacks, once, in first-seen order. */
export const TECH_BAND: string[] = [...new Set(caseStudies.flatMap((p) => p.stack))];
