import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    project: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    contactMessage: {
      createMany: vi.fn(),
    },
  },
}));

const app = createApp({ contactLimit: 100 });

// The error middleware logs before responding, which is correct in production
// and only noise here.
const logged = vi.spyOn(console, "error").mockImplementation(() => {});

const message = {
  name: "Jane Recruiter",
  email: "jane@example.com",
  message: "Loved your portfolio, let's talk!",
  elapsedMs: 12_000,
};

beforeEach(() => {
  vi.mocked(prisma.project.findMany).mockReset();
  vi.mocked(prisma.project.findUnique).mockReset();
  vi.mocked(prisma.contactMessage.createMany).mockReset();
  logged.mockClear();
});

afterAll(() => {
  logged.mockRestore();
});

describe("when the database is unreachable", () => {
  // Express 4 does not await route handlers, so before asyncRoute these
  // rejections never reached any error handler: the request was left open, the
  // frontend's fetch never settled, and the work section sat on loading
  // skeletons forever instead of showing its error state.
  const down = () => new Error("connect ECONNREFUSED 127.0.0.1:5432");

  it("answers the project list with 500 rather than hanging", async () => {
    vi.mocked(prisma.project.findMany).mockRejectedValue(down());

    const res = await request(app).get("/api/projects");

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Internal server error");
  });

  it("answers a single case study with 500", async () => {
    vi.mocked(prisma.project.findUnique).mockRejectedValue(down());

    const res = await request(app).get("/api/projects/dms");
    expect(res.status).toBe(500);
  });

  it("answers a contact submission with 500", async () => {
    vi.mocked(prisma.contactMessage.createMany).mockRejectedValue(down());

    const res = await request(app).post("/api/contact").send(message);
    expect(res.status).toBe(500);
  });

  it("leaks neither the message nor a stack trace", async () => {
    vi.mocked(prisma.project.findMany).mockRejectedValue(down());

    const res = await request(app).get("/api/projects");
    const body = JSON.stringify(res.body);

    expect(body).not.toContain("ECONNREFUSED");
    expect(body).not.toContain("5432");
    expect(res.body.stack).toBeUndefined();
  });
});

describe("what reaches the server log", () => {
  it("keeps a visitor's details out of it when an insert fails", async () => {
    // Prisma validation errors spell out the arguments of the failed call, so
    // logging err as-is would put the sender's address and words in journald.
    const error = Object.assign(
      new Error(
        `Invalid \`prisma.contactMessage.createMany()\` invocation: { data: [{ name: "${message.name}", email: "${message.email}", message: "${message.message}" }] }`,
      ),
      { name: "PrismaClientValidationError" },
    );
    vi.mocked(prisma.contactMessage.createMany).mockRejectedValue(error);

    await request(app).post("/api/contact").send(message);

    const line = logged.mock.calls.flat().join(" ");
    expect(line).toContain("POST /api/contact");
    expect(line).toContain("PrismaClientValidationError");
    expect(line).not.toContain(message.email);
    expect(line).not.toContain(message.name);
    expect(line).not.toContain("Loved your portfolio");
  });

  it("still says what broke on the routes that carry no personal data", async () => {
    // The P2022 outage was diagnosed from exactly this kind of line.
    vi.mocked(prisma.project.findMany).mockRejectedValue(
      Object.assign(new Error("The column `Project.category` does not exist"), { code: "P2022" }),
    );

    await request(app).get("/api/projects");

    const line = logged.mock.calls.flat().join(" ");
    expect(line).toContain("GET /api/projects");
    expect(line).toContain("P2022");
    expect(line).toContain("Project.category");
  });
});

describe("an unknown API path", () => {
  it("answers with JSON, not Express's HTML error page", async () => {
    // The frontend calls res.json() on every response, so an HTML body came
    // back to it as a JSON syntax error rather than as the 404 it was.
    const res = await request(app).get("/api/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.type).toBe("application/json");
    expect(res.body.error).toBe("Not found");
  });

  it("still returns the route's own 404 for a missing project", async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValue(null);

    const res = await request(app).get("/api/projects/no-such-slug");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Project not found");
  });
});
