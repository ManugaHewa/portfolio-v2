import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { readConfig } from "../config.js";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    project: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn() },
    contactMessage: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
  },
}));

const message = {
  name: "Jane Recruiter",
  email: "jane@example.com",
  message: "Loved your portfolio, let's talk!",
  elapsedMs: 12_000,
};

describe("CORS", () => {
  const app = createApp({ corsOrigins: ["https://manugahewa.dev"] });

  it("allows the site's own origin", async () => {
    const res = await request(app).get("/api/health").set("Origin", "https://manugahewa.dev");
    expect(res.headers["access-control-allow-origin"]).toBe("https://manugahewa.dev");
  });

  it("gives any other origin nothing to read the response with", async () => {
    // The old bare cors() answered `*` here.
    const res = await request(app).get("/api/health").set("Origin", "https://evil.example");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("HSTS", () => {
  it("stays at the six months Cloudflare is set to, not helmet 8's year", async () => {
    const res = await request(createApp()).get("/api/health");
    expect(res.headers["strict-transport-security"]).toBe("max-age=15552000; includeSubDomains");
  });
});

describe("request bodies", () => {
  const app = createApp({ contactLimit: 100 });

  it("answers malformed JSON with a 400, not a 500", async () => {
    const res = await request(app)
      .post("/api/contact")
      .set("Content-Type", "application/json")
      .send('{"name": "Jane",');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid request body" });
  });

  it("refuses a body over 10 kB before it reaches validation", async () => {
    const res = await request(app)
      .post("/api/contact")
      .send({ ...message, message: "x".repeat(12_000) });

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: "Request body too large" });
  });
});

describe("rate limits", () => {
  it("caps contact submissions per client and says so in JSON", async () => {
    const app = createApp({ contactLimit: 2 });
    const send = () =>
      request(app).post("/api/contact").set("X-Forwarded-For", "203.0.113.10").send(message);

    expect((await send()).status).toBe(201);
    expect((await send()).status).toBe(201);

    const third = await send();
    expect(third.status).toBe(429);
    expect(third.type).toBe("application/json");
    expect(third.body.error).toMatch(/too many messages/i);
    expect(third.headers.ratelimit).toBeDefined();
  });

  it("counts each visitor separately, using the address Nginx forwards", async () => {
    // Behind Nginx every request arrives from 127.0.0.1. If the API keyed on
    // that, one visitor's five messages would lock out everyone else.
    const app = createApp({ contactLimit: 1 });
    const from = (ip: string) =>
      request(app).post("/api/contact").set("X-Forwarded-For", ip).send(message);

    expect((await from("203.0.113.20")).status).toBe(201);
    expect((await from("203.0.113.20")).status).toBe(429);
    expect((await from("203.0.113.21")).status).toBe(201);
  });

  it("applies a gentler limit across the whole API", async () => {
    const app = createApp({ apiLimit: 3 });
    const hit = () => request(app).get("/api/health").set("X-Forwarded-For", "203.0.113.30");

    for (let i = 0; i < 3; i++) expect((await hit()).status).toBe(200);
    expect((await hit()).status).toBe(429);
  });

  it("trusts forwarding headers from loopback only", () => {
    // Express compiles the setting into this function; it decides, per hop,
    // whether the address that handed over the request may vouch for another.
    const trust = createApp().get("trust proxy fn") as (addr: string, hop: number) => boolean;

    expect(trust("127.0.0.1", 0)).toBe(true);
    expect(trust("::1", 0)).toBe(true);
    expect(trust("192.168.1.50", 0)).toBe(false);
    expect(trust("203.0.113.9", 0)).toBe(false);
  });
});

describe("configuration defaults", () => {
  it("allows only the production origin unless told otherwise", () => {
    expect(readConfig({}).corsOrigins).toEqual(["https://manugahewa.dev"]);
    // Including the value the server's .env carried for months.
    expect(readConfig({ NODE_ENV: "production" }).corsOrigins).toEqual(["https://manugahewa.dev"]);
  });

  it("adds the Vite dev server only in development", () => {
    expect(readConfig({ NODE_ENV: "development" }).corsOrigins).toContain("http://localhost:5173");
  });

  it("takes an explicit list over the defaults", () => {
    expect(readConfig({ CORS_ORIGINS: "https://a.example, https://b.example" }).corsOrigins).toEqual([
      "https://a.example",
      "https://b.example",
    ]);
  });

  it("leaves Turnstile off unless a secret is set", () => {
    expect(readConfig({}).turnstileSecret).toBeNull();
    expect(readConfig({ TURNSTILE_SECRET_KEY: "   " }).turnstileSecret).toBeNull();
    expect(readConfig({ TURNSTILE_SECRET_KEY: "0x4AAA" }).turnstileSecret).toBe("0x4AAA");
  });
});
