import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    contactMessage: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  },
}));

// The rate limit has its own tests; here it would only get in the way.
const app = createApp({ contactLimit: 100 });
const insert = vi.mocked(prisma.contactMessage.createMany);

const valid = {
  name: "Jane Recruiter",
  email: "jane@example.com",
  message: "Loved your portfolio, let's talk!",
  website: "",
  elapsedMs: 12_000,
};

beforeEach(() => insert.mockClear());

describe("POST /api/contact", () => {
  it("rejects an invalid payload", async () => {
    const res = await request(app).post("/api/contact").send({ name: "" });
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("stores a valid message and echoes nothing back", async () => {
    const res = await request(app).post("/api/contact").send(valid);

    expect(res.status).toBe(201);
    // No row id: the frontend never used it, and the response should carry
    // nothing a client does not need.
    expect(res.body).toEqual({ status: "received" });
    expect(insert).toHaveBeenCalledWith({
      data: [{ name: valid.name, email: valid.email, message: valid.message }],
    });
  });

  it("stores the trimmed values", async () => {
    await request(app)
      .post("/api/contact")
      .send({ ...valid, name: "  Jane Recruiter  ", email: " jane@example.com " });

    expect(insert.mock.calls[0][0]).toEqual({
      data: [{ name: "Jane Recruiter", email: "jane@example.com", message: valid.message }],
    });
  });

  it("rejects fields the form never sends instead of quietly dropping them", async () => {
    const res = await request(app)
      .post("/api/contact")
      .send({ ...valid, id: "chosen-by-client", createdAt: "1999-01-01" });

    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("answers a filled honeypot like a real message and stores nothing", async () => {
    const res = await request(app)
      .post("/api/contact")
      .send({ ...valid, website: "https://cheap-backlinks.example" });

    // Same status and body as a stored message, so a bot cannot tell.
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ status: "received" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("drops a message sent faster than a person could have written it", async () => {
    const res = await request(app).post("/api/contact").send({ ...valid, elapsedMs: 400 });

    expect(res.status).toBe(201);
    expect(insert).not.toHaveBeenCalled();
  });

  it("refuses a bare POST without the timing field", async () => {
    const bare: Record<string, unknown> = { ...valid };
    delete bare.elapsedMs;
    const res = await request(app).post("/api/contact").send(bare);

    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });
});
