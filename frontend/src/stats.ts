/**
 * Every number the page shows about itself, derived from the data rather
 * than typed in, so a project or skill added to its source file updates the
 * counts, the project numbers and the tech band with it.
 *
 * The project list comes from content/projects.ts, the same file the
 * database is seeded from and the prerender writes into the HTML (a CI test
 * checks the API serves exactly that list), so these numbers agree with the
 * projects on screen. It arrives through `virtual:project-index`, a slim
 * copy vite.config.ts generates with only the fields used here, so the case
 * studies' full text stays out of the main bundle.
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

/**
 * Each project's slug, title and tier in page order: the case studies first,
 * then the other work, each in content order. The skills section uses it to
 * turn an evidence title into a link.
 */
export const PROJECT_INDEX: ReadonlyArray<{ slug: string; title: string; tier: number }> = [
  ...caseStudies,
  ...otherProjects,
].map(({ slug, title, tier }) => ({ slug, title, tier }));

const NUMBERS = new Map(PROJECT_INDEX.map((p, i) => [p.slug, String(i + 1).padStart(2, "0")]));

/**
 * A project's number on this page: "01" to "06" for the case studies, then
 * "07" onward for the other work, each in content order. Every place that
 * shows a project number uses this, so they cannot disagree. An unknown slug
 * gets an empty string rather than a made-up number.
 */
export function projectNumber(slug: string): string {
  return NUMBERS.get(slug) ?? "";
}

/**
 * The tech band: every technology named in the case studies' stacks, once,
 * in the order it first appears.
 */
export const TECH_BAND: string[] = [...new Set(caseStudies.flatMap((p) => p.stack))];
