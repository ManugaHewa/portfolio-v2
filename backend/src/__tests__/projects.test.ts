import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { app } from "../index.js";
import { prisma } from "../lib/prisma.js";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    project: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    contactMessage: { create: vi.fn() },
  },
}));

describe("GET /api/projects", () => {
  it("returns the fields the cards are built from", async () => {
    // The card grid splits on tier and prints category and status as pills, so
    // these have to be on the *list* payload. Leaving them to the detail route
    // would mean a card could not render until its modal had been opened.
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      {
        slug: "dms",
        title: "Donation Management System (DMS)",
        subtitle: "Donation operations for a working charity.",
        stack: ["TypeScript", "Prisma"],
        role: "Solo Full-stack Developer",
        timeline: "2026 - present",
        category: "Full-stack web",
        status: "In active development",
        tier: 1,
        outcomes: [],
        links: [{ label: "GitHub repository", url: "https://example.com/dms" }],
      },
    ] as never);

    const res = await request(app).get("/api/projects");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    for (const field of ["slug", "title", "subtitle", "stack", "role", "timeline", "category", "status", "tier", "outcomes", "links"]) {
      expect(res.body[0], `missing ${field}`).toHaveProperty(field);
    }
  });

  it("asks Postgres for the stored order rather than sorting on the client", async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([] as never);

    await request(app).get("/api/projects");

    expect(vi.mocked(prisma.project.findMany).mock.calls[0][0]).toMatchObject({
      orderBy: { position: "asc" },
    });
  });
});

describe("GET /api/projects/:slug", () => {
  it("returns the case-study fields the modal renders", async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      slug: "dms",
      title: "Donation Management System (DMS)",
      challenges: ["requireAdmin resolved to undefined"],
      nextSteps: ["Receipt generation and annual tax slips."],
      learned: "PostgreSQL schema design and Prisma migrations.",
      links: [],
    } as never);

    const res = await request(app).get("/api/projects/dms");

    expect(res.status).toBe(200);
    // The three fields added for the source-list rewrite. They ride along on
    // the detail route's include rather than being selected one by one, which
    // is exactly the kind of thing that silently stops being true.
    expect(res.body.challenges).toHaveLength(1);
    expect(res.body.nextSteps).toHaveLength(1);
    expect(res.body.learned).toContain("Prisma");
  });
});
