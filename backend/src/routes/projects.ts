import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const projectsRouter = Router();

// Links are ordered by their stored position so the primary repository stays
// first, rather than coming back in whatever order Postgres happens to return.
const linkSelect = {
  select: { label: true, url: true },
  orderBy: { position: "asc" },
} as const;

// GET /api/projects: list all projects (card summaries)
projectsRouter.get("/", async (_req, res) => {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      slug: true,
      title: true,
      subtitle: true,
      stack: true,
      links: linkSelect,
    },
  });
  res.json(projects);
});

// GET /api/projects/:slug: full case study for the project modal
projectsRouter.get("/:slug", async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { slug: req.params.slug },
    include: { links: linkSelect },
  });

  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  res.json(project);
});
