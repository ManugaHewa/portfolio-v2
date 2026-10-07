import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { PROJECTS, projectSummaries } from "../../../content/projects.js";

/**
 * Against a real, seeded database: CI runs the migrations and the seed before
 * the tests, and sets RUN_DB_TESTS=1. Anywhere else this suite skips itself.
 * The switch is explicit rather than "DATABASE_URL is set", because importing
 * Prisma loads backend/.env, which would turn the suite on for anyone with a
 * local .env and no database running. To run it locally against a seeded
 * database: set RUN_DB_TESTS=1 and DATABASE_URL, then `npm test`.
 *
 * Why it exists: the prerendered HTML is built from content/projects.ts
 * directly, while the page then refreshes the same cards from the API. If the
 * two disagreed, a visitor would watch the cards change under them, and
 * React would refuse the server's HTML. This pins them to each other.
 */
describe.runIf(process.env.RUN_DB_TESTS === "1")("the API and the prerendered HTML agree", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("serves exactly projectSummaries() from GET /api/projects", async () => {
    const res = await request(createApp()).get("/api/projects");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(projectSummaries());
  });

  it("serves every case study, and only public fields, from GET /api/projects/:slug", async () => {
    const app = createApp({ apiLimit: 1000 });
    for (const project of PROJECTS) {
      const res = await request(app).get(`/api/projects/${project.slug}`);
      expect(res.status, project.slug).toBe(200);
      expect(res.body.title).toBe(project.title);
      expect(res.body).not.toHaveProperty("id");
      expect(res.body).not.toHaveProperty("createdAt");
    }
  });
});
