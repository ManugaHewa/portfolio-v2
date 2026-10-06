import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    contactMessage: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
  },
}));

const insert = vi.mocked(prisma.contactMessage.createMany);
const fetchMock = vi.fn();

const message = {
  name: "Jane Recruiter",
  email: "jane@example.com",
  message: "Loved your portfolio, let's talk!",
  elapsedMs: 12_000,
  turnstileToken: "token-from-widget",
};

const answer = (body: unknown, ok = true) =>
  Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);

beforeEach(() => {
  insert.mockClear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("with Turnstile switched on", () => {
  const app = createApp({ contactLimit: 100, turnstileSecret: "test-secret" });

  it("stores the message once Cloudflare vouches for the token", async () => {
    fetchMock.mockReturnValue(answer({ success: true }));

    const res = await request(app).post("/api/contact").send(message);

    expect(res.status).toBe(201);
    expect(insert).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    const sent = new URLSearchParams(String(init.body));
    expect(sent.get("secret")).toBe("test-secret");
    expect(sent.get("response")).toBe("token-from-widget");
  });

  it("refuses a token Cloudflare rejects", async () => {
    fetchMock.mockReturnValue(answer({ success: false, "error-codes": ["invalid-input-response"] }));

    const res = await request(app).post("/api/contact").send(message);

    expect(res.status).toBe(403);
    expect(insert).not.toHaveBeenCalled();
  });

  it("refuses a submission with no token without asking Cloudflare", async () => {
    const noToken: Record<string, unknown> = { ...message };
    delete noToken.turnstileToken;
    const res = await request(app).post("/api/contact").send(noToken);

    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed when Cloudflare cannot be reached", async () => {
    fetchMock.mockRejectedValue(new Error("getaddrinfo ENOTFOUND challenges.cloudflare.com"));

    const res = await request(app).post("/api/contact").send(message);

    expect(res.status).toBe(403);
    expect(insert).not.toHaveBeenCalled();
  });

  it("does not spend a verification on an obvious bot", async () => {
    await request(app).post("/api/contact").send({ ...message, website: "spam" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("with Turnstile switched off, the default", () => {
  const app = createApp({ contactLimit: 100, turnstileSecret: null });

  it("never calls Cloudflare and still accepts a token field", async () => {
    // The frontend and the API can be switched on in either order, so a token
    // arriving at an API that is not checking yet must not be a 400.
    const res = await request(app).post("/api/contact").send(message);

    expect(res.status).toBe(201);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
