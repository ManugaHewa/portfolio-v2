import { SectionHead } from "../motion";
import { Scene } from "./Scene";
import { projectNumber } from "../stats";

/**
 * How the project list reaches the page (redesign SPEC.md, section 5.5).
 * Each node cites the file that makes it true.
 *
 * Stub from the scaffold: the final copy as a plain ordered list; the
 * pipeline agent draws the scroll-built diagram.
 */
const NODES = [
  { label: "content/projects.ts", text: "Every project, written once.", source: "content/projects.ts" },
  {
    label: "backend/prisma/seed.ts",
    text: "Copies it into Postgres on every deploy.",
    source: "scripts/deploy.sh",
  },
  { label: "PostgreSQL", text: "The Project and ProjectLink tables.", source: "backend/prisma/schema.prisma" },
  {
    label: "GET /api/projects",
    text: "Express and Prisma serve the list.",
    source: "backend/src/routes/projects.ts",
  },
  { label: "This page", text: "Fetches the list once it has loaded.", source: "frontend/src/App.tsx" },
];

export function Pipeline() {
  return (
    <section className="section pipeline" id="pipeline" aria-labelledby="pipeline-heading">
      <Scene variant="corridor" className="scene-layer scene-corridor" />
      <div className="container pipeline-inner">
        <SectionHead
          titleId="pipeline-heading"
          title="How the projects reach this page"
          intro={`This site is project ${projectNumber("portfolio-v2")}. Its project list starts as one TypeScript file and reaches you by two routes.`}
        />

        <ol className="pipeline-list">
          {NODES.map((node) => (
            <li className="pipeline-node" key={node.label}>
              <span className="pipeline-node-label mono">{node.label}</span>
              <span className="pipeline-node-text">{node.text}</span>
              <span className="pipeline-node-source mono">{node.source}</span>
            </li>
          ))}
        </ol>

        <p className="pipeline-route">
          <span className="mono">frontend/scripts/prerender.mjs</span>: Writes the same list into the
          HTML at build time.
        </p>
        <p className="pipeline-note">
          A CI test checks the API returns exactly the list the HTML was built from.{" "}
          <span className="mono">backend/src/__tests__/content.integration.test.ts</span>
        </p>
      </div>
    </section>
  );
}
