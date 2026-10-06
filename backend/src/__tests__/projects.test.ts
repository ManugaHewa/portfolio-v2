import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    project: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    contactMessage: { createMany: vi.fn() },
  },
}));

const app = createApp();
const findUnique = vi.mocked(prisma.project.findUnique);

beforeEach(() => {
  vi.mocked(prisma.project.findMany).mockReset();
  findUnique.mockReset();
});

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
    findUnique.mockResolvedValue({
      slug: "dms",
      title: "Donation Management System (DMS)",
      challenges: ["requireAdmin resolved to undefined"],
      nextSteps: ["Receipt generation and annual tax slips."],
      learned: "PostgreSQL schema design and Prisma migrations.",
      links: [],
    } as never);

    const res = await request(app).get("/api/projects/dms");

    expect(res.status).toBe(200);
    expect(res.body.challenges).toHaveLength(1);
    expect(res.body.nextSteps).toHaveLength(1);
    expect(res.body.learned).toContain("Prisma");
  });

  it("asks for the public fields by name and nothing else", async () => {
    // This route used `include`, which returns every column, so anything added
    // to the table went public with the migration. The exact list is pinned
    // here: publishing a new field means changing this test on purpose.
    findUnique.mockResolvedValue(null);

    await request(app).get("/api/projects/dms");

    const { select } = findUnique.mock.calls[0][0] as { select: Record<string, unknown> };
    expect(Object.keys(select).sort()).toEqual(
      [
        "slug", "title", "subtitle", "stack", "role", "timeline", "category", "status", "tier",
        "outcomes", "links", "context", "problem", "scope", "stakeholders", "requirements",
        "nonFunctional", "deliveryProcess", "risks", "challenges", "highlights", "nextSteps",
        "learned",
      ].sort(),
    );
    for (const internal of ["id", "position", "createdAt", "updatedAt"]) {
      expect(select, `${internal} must stay private`).not.toHaveProperty(internal);
    }
  });

  it.each([
    ["an uppercase slug", "DMS"],
    ["path traversal", "..%2F..%2Fetc%2Fpasswd"],
    ["a quote", "dms'"],
    ["an overlong slug", "a".repeat(81)],
  ])("answers %s with a 404 and no query", async (_label, slug) => {
    const res = await request(app).get(`/api/projects/${slug}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Project not found");
    expect(findUnique).not.toHaveBeenCalled();
  });
});
