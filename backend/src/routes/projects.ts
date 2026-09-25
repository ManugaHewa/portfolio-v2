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

// GET /api/projects: list all projects (card summaries)
//
// Role, timeline and outcomes come back with the list, not just the detail
// view. The cards are the first evidence a reader sees, and "what was your
// part in this, and what came of it" is exactly what they are scanning for -
// making them open a modal to find out loses most people before they do.
projectsRouter.get(
  "/",
  asyncRoute(async (_req, res) => {
    const projects = await prisma.project.findMany({
      orderBy: { position: "asc" },
      select: {
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
      },
    });
    res.json(projects);
  }),
);

// GET /api/projects/:slug: full case study for the project modal
projectsRouter.get(
  "/:slug",
  asyncRoute(async (req, res) => {
    const project = await prisma.project.findUnique({
      where: { slug: req.params.slug },
      include: { links: linkSelect },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    res.json(project);
  }),
);
