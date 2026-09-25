import express from "express";
import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { projectsRouter } from "./routes/projects.js";
import { contactRouter } from "./routes/contact.js";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/", (_req, res) =>
  res.json({
    service: "portfolio-api",
    endpoints: ["/api/health", "/api/projects", "/api/projects/:slug", "/api/contact"],
  })
);

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/projects", projectsRouter);
app.use("/api/contact", contactRouter);

// An unknown /api path used to fall through to Express's default handler, which
// answers with an HTML "Cannot GET" page. The frontend calls res.json() on
// every response, so it reported that as a JSON syntax error rather than as the
// 404 it actually was.
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Four parameters, or Express does not recognise this as error middleware and
// silently treats it as an ordinary one. Every route is wrapped in asyncRoute,
// so a rejected query lands here instead of hanging the request open.
app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  // Something already started writing, so the status is sent and the only
  // honest thing left is to let Express abort the stream.
  if (res.headersSent) return next(err);

  console.error("Unhandled error while serving request:", err);
  // No message, no stack: the client gets what it needs to retry and nothing
  // about the schema or the query that failed.
  res.status(500).json({ error: "Internal server error" });
});

const port = process.env.PORT ?? 4000;

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}
