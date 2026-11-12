/**
 * A project's own page (/work/<slug>/), written at build time by
 * scripts/prerender.mjs from CaseStudyPage.tsx. Its own module so the home
 * page can link there without bundling the page.
 */
export const caseStudyPath = (slug: string) => `/work/${slug}/`;
