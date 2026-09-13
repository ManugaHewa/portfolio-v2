import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const projectsRouter = Router();

// GET /api/projects — list all projects (card summaries)
projectsRouter.get("/", async (_req, res) => {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      slug: true,
      title: true,
      subtitle: true,
      stack: true,
      githubUrl: true,
      liveUrl: true,
    },
  });
  res.json(projects);
});

// GET /api/projects/:slug — full detail for the project modal
projectsRouter.get("/:slug", async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { slug: req.params.slug },
  });

  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  res.json(project);
});
