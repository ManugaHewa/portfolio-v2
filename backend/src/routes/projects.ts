import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncRoute } from "../lib/asyncRoute.js";

export const projectsRouter = Router();

// Links are ordered by their stored position so the primary repository stays
// first, rather than coming back in whatever order Postgres happens to return.
const linkSelect = {
  select: { label: true, url: true },
  orderBy: { position: "asc" },
} as const;

// What a card is built from.
//
// Role, timeline and outcomes come back with the list, not just the detail
// view. The cards are the first evidence a reader sees, and "what was your
// part in this, and what came of it" is exactly what they are scanning for -
// making them open a modal to find out loses most people before they do.
const summarySelect = {
  slug: true,
  title: true,
  subtitle: true,
  stack: true,
  role: true,
  timeline: true,
  category: true,
  status: true,
  // The page splits these into full cards and rows under Other work, so
  // the band has to travel with the summary rather than being inferred
  // from the ordering on the client.
  tier: true,
  outcomes: true,
  links: linkSelect,
} as const;

// The full case study for the modal, named field by field. This route used
// `include`, which returned every column the table has, so a column added for
// internal use would have gone public the moment it was migrated. Listing the
// fields means publishing one is a decision; the id, ordering and timestamps
// stay in the database.
const detailSelect = {
  ...summarySelect,
  context: true,
  problem: true,
  scope: true,
  stakeholders: true,
  requirements: true,
  nonFunctional: true,
  deliveryProcess: true,
  risks: true,
  challenges: true,
  highlights: true,
  nextSteps: true,
  learned: true,
} as const;

// Lowercase words joined by single hyphens, which is every slug the seed has
// ever written. Anything else cannot be a project, so it is answered without
// a query.
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MAX = 80;

// GET /api/projects: list all projects (card summaries)
projectsRouter.get(
  "/",
  asyncRoute(async (_req, res) => {
    const projects = await prisma.project.findMany({
      orderBy: { position: "asc" },
      select: summarySelect,
    });
    res.json(projects);
  }),
);

// GET /api/projects/:slug: full case study for the project modal
projectsRouter.get(
  "/:slug",
  asyncRoute(async (req, res) => {
    const { slug } = req.params;

    if (slug.length > SLUG_MAX || !SLUG.test(slug)) {
      return res.status(404).json({ error: "Project not found" });
    }

    const project = await prisma.project.findUnique({
      where: { slug },
      select: detailSelect,
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    res.json(project);
  }),
);
