import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { app } from "../index.js";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    contactMessage: {
      create: vi.fn().mockResolvedValue({ id: "test-id" }),
    },
  },
}));

describe("POST /api/contact", () => {
  it("rejects an invalid payload", async () => {
    const res = await request(app).post("/api/contact").send({ name: "" });
    expect(res.status).toBe(400);
  });

  it("accepts a valid payload", async () => {
    const res = await request(app).post("/api/contact").send({
      name: "Jane Recruiter",
      email: "jane@example.com",
      message: "Loved your portfolio, let's talk!",
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("received");
  });
});
