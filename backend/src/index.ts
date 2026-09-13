import express from "express";
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

const port = process.env.PORT ?? 4000;

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}
