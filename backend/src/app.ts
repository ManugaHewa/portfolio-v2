import express from "express";
import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { projectsRouter } from "./routes/projects.js";
import { createContactRouter } from "./routes/contact.js";
import { readConfig } from "./config.js";

export interface AppOptions {
  /** POST /api/contact requests allowed per client per window. */
  contactLimit?: number;
  /** Requests allowed per client per window across the whole of /api. */
  apiLimit?: number;
  windowMs?: number;
  /** See ContactOptions. */
  minSubmitMs?: number;
  corsOrigins?: string[];
  turnstileSecret?: string | null;
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/**
 * Builds the API. A factory rather than a module-level instance so that every
 * test file gets its own rate-limit counters instead of sharing one set and
 * failing depending on the order the files ran in.
 */
export function createApp(options: AppOptions = {}) {
  const config = readConfig();
  const {
    contactLimit = 5,
    apiLimit = 300,
    windowMs = FIFTEEN_MINUTES,
    minSubmitMs = 3000,
    corsOrigins = config.corsOrigins,
    turnstileSecret = config.turnstileSecret,
  } = options;

  const app = express();

  // Requests arrive through Cloudflare, cloudflared and then Nginx, and only
  // Nginx talks to this process, from loopback. Trusting exactly that hop
  // means req.ip is the address Nginx forwarded; a client that writes its own
  // X-Forwarded-For only ever adds entries to the untrusted end. Without this,
  // every visitor shares 127.0.0.1 and one rate-limit bucket.
  app.set("trust proxy", "loopback");

  app.use(helmet());

  // The frontend is served from the same origin, so a browser never needs
  // CORS to reach this API. The allow-list is for anything deliberate beyond
  // that; the old bare cors() answered `*` to every site on the internet.
  app.use(cors({ origin: corsOrigins }));

  // Limits run before the body is parsed, so a client over its budget costs
  // a header check rather than a JSON parse.
  const limitReached = (message: string) => ({
    windowMs,
    standardHeaders: "draft-8" as const,
    legacyHeaders: false,
    // JSON, because the frontend reads every response with res.json().
    message: { error: message },
  });
  app.use(
    "/api",
    rateLimit({ ...limitReached("Too many requests. Try again in a few minutes."), limit: apiLimit }),
  );
  app.post(
    "/api/contact",
    rateLimit({
      ...limitReached("Too many messages from this address. Try again later, or email me directly."),
      limit: contactLimit,
    }),
  );

  // 10 kB comfortably holds the largest valid message (2000 characters is at
  // most about 8 kB of UTF-8), and nothing else here accepts a body at all.
  app.use(express.json({ limit: "10kb" }));

  app.get("/", (_req, res) =>
    res.json({
      service: "portfolio-api",
      endpoints: ["/api/health", "/api/projects", "/api/projects/:slug", "/api/contact"],
    }),
  );

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api/projects", projectsRouter);
  app.use("/api/contact", createContactRouter({ minSubmitMs, turnstileSecret }));

  // An unknown /api path used to fall through to Express's default handler, which
  // answers with an HTML "Cannot GET" page. The frontend calls res.json() on
  // every response, so it reported that as a JSON syntax error rather than as the
  // 404 it actually was.
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use(errorHandler);

  return app;
}

/** What a client is told for an error it caused. Nothing about the server. */
const CLIENT_ERRORS: Record<number, string> = {
  400: "Invalid request body",
  413: "Request body too large",
  415: "Unsupported request body",
};

/**
 * The status of an error the client caused, such as malformed JSON or a body
 * over the limit; body-parser marks those with a 4xx `status`. Anything else
 * is ours, and a 500.
 */
function clientErrorStatus(err: unknown): number | null {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === "number" && status >= 400 && status < 500 ? status : null;
}

/**
 * One line for the journal: method, path, error name and code. The message is
 * left out on the contact route, because a Prisma validation error spells out
 * the arguments of the call that failed, which there means a visitor's name,
 * email and message.
 */
function describeError(req: Request, err: unknown): string {
  const e = (err ?? {}) as { name?: unknown; code?: unknown; message?: unknown };
  const path = req.originalUrl.split("?")[0];
  const parts = [req.method, path, typeof e.name === "string" ? e.name : "Error"];
  if (typeof e.code === "string") parts.push(e.code);
  if (!path.startsWith("/api/contact") && typeof e.message === "string") {
    parts.push(e.message.slice(0, 500));
  }
  return parts.join(" ");
}

// Four parameters, or Express does not recognise this as error middleware and
// silently treats it as an ordinary one. Every route is wrapped in asyncRoute,
// so a rejected query lands here instead of hanging the request open.
function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  // Something already started writing, so the status is sent and the only
  // honest thing left is to let Express abort the stream.
  if (res.headersSent) return next(err);

  const status = clientErrorStatus(err);
  if (status !== null) {
    return res.status(status).json({ error: CLIENT_ERRORS[status] ?? "Bad request" });
  }

  console.error("Unhandled error while serving request:", describeError(req, err));
  // No message, no stack: the client gets what it needs to retry and nothing
  // about the schema or the query that failed.
  res.status(500).json({ error: "Internal server error" });
}
