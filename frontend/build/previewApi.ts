import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

/*
 * `vite preview` serves the built site, and proxies /api to the Express API
 * on :4000 (vite.config.ts, server.proxy). That API needs Postgres, so a
 * preview on a machine without the backend running showed the prerendered
 * page fine but failed every case study ("couldn't load").
 *
 * This middleware, for the preview server only, checks whether the API is
 * up. If it is, the request goes on to the proxy as before. If it is not, the
 * read-only project routes are answered from content/projects.ts, the same
 * source the API is seeded from (a CI test checks the two agree), and a
 * contact message gets an honest 503: nothing pretends a message was sent.
 */

const API = "http://localhost:4000";
// Fields the API sends as lists; absent in the content they come back empty,
// the way Prisma returns them.
const LISTS = [
  "scope",
  "stakeholders",
  "requirements",
  "nonFunctional",
  "deliveryProcess",
  "risks",
  "challenges",
  "highlights",
  "nextSteps",
  "outcomes",
];

interface Content {
  PROJECTS: Array<Record<string, unknown> & { slug: string }>;
  projectSummaries(): unknown[];
}

let apiUp: { at: number; up: boolean } | null = null;

/** Whether the API answers, remembered for a few seconds. */
async function apiAnswers(): Promise<boolean> {
  if (apiUp && Date.now() - apiUp.at < 5000) return apiUp.up;
  let up = false;
  try {
    const res = await fetch(`${API}/api/health`, { signal: AbortSignal.timeout(400) });
    up = res.ok;
  } catch {
    up = false;
  }
  apiUp = { at: Date.now(), up };
  return up;
}

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
};

/** `loadContent` reads and evaluates content/projects.ts (vite.config.ts). */
export function previewApi(loadContent: () => Promise<Content>): Plugin {
  return {
    name: "preview-api-fallback",
    configurePreviewServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const path = new URL(req.url ?? "/", "http://x").pathname;
        if (!path.startsWith("/api/")) return next();
        void (async () => {
          if (await apiAnswers()) return next();
          if (req.method === "GET" && path === "/api/projects") {
            return json(res, 200, (await loadContent()).projectSummaries());
          }
          const one = /^\/api\/projects\/([a-z0-9-]+)$/.exec(path);
          if (req.method === "GET" && one) {
            const p = (await loadContent()).PROJECTS.find((x) => x.slug === one[1]);
            if (!p) return json(res, 404, { error: "Not found" });
            const detail: Record<string, unknown> = {
              context: null,
              problem: null,
              learned: null,
              role: null,
              timeline: null,
              category: null,
              status: null,
              ...p,
            };
            for (const k of LISTS) detail[k] = p[k] ?? [];
            return json(res, 200, detail);
          }
          if (path === "/api/health") return json(res, 503, { status: "api not running" });
          return json(res, 503, {
            error: "The API is not running. Start it with `npm run dev:backend` to try this.",
          });
        })();
      });
    },
  };
}
