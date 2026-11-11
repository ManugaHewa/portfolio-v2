import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CI_CHECK, PIPELINE_NODES, PRERENDER_ROUTE, Pipeline } from "../components/Pipeline";
import { PIN_QUERY } from "../motion";
import { projectNumber } from "../stats";
import { Wrap, installMatchMedia } from "./motion/helpers";

// From the import.meta.url string, never through `new URL()`: under jsdom the
// URL class is jsdom's, which does not resolve file: URLs the way Node does.
const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const read = (path: string) => readFileSync(join(REPO, path), "utf8");

const renderPipeline = () =>
  render(
    <Wrap>
      <Pipeline />
    </Wrap>,
  );

let media: ReturnType<typeof installMatchMedia> | null = null;
afterEach(() => {
  media?.restore();
  media = null;
});

describe("Pipeline: the diagram is true", () => {
  const cited = [...PIPELINE_NODES.map((n) => n.source), PRERENDER_ROUTE.source, CI_CHECK.source];

  it.each(cited)("cites %s, which exists in the repository", (path) => {
    expect(existsSync(join(REPO, path))).toBe(true);
  });

  // Existing is not enough: each file still has to do what its node says.
  it("cites files that still say what the nodes claim", () => {
    expect(read("content/projects.ts")).toMatch(/export const PROJECTS/);
    expect(read("scripts/deploy.sh")).toMatch(/backend\/prisma\/seed\.ts/);
    const schema = read("backend/prisma/schema.prisma");
    expect(schema).toMatch(/^model Project \{/m);
    expect(schema).toMatch(/^model ProjectLink \{/m);
    expect(schema).toMatch(/provider\s*=\s*"postgresql"/);
    expect(read("backend/src/routes/projects.ts")).toMatch(/GET \/api\/projects/);
    expect(read("backend/src/app.ts")).toMatch(/app\.use\("\/api\/projects"/);
    expect(read("frontend/src/App.tsx")).toMatch(/getProjects\(\)/);
    expect(read("frontend/src/api.ts")).toMatch(/request<ProjectSummary\[\]>\("\/projects"\)/);
    expect(read("frontend/scripts/prerender.mjs")).toMatch(/initial-projects/);
    expect(read(CI_CHECK.source)).toMatch(/GET \/api\/projects/);
  });

  it("names the five nodes in order, with the spec's words", () => {
    expect(PIPELINE_NODES.map((n) => n.label)).toEqual([
      "content/projects.ts",
      "backend/prisma/seed.ts",
      "PostgreSQL",
      "GET /api/projects",
      "This page",
    ]);
    expect(PRERENDER_ROUTE.label).toBe("frontend/scripts/prerender.mjs");
  });
});

describe("Pipeline: markup", () => {
  it("is the #pipeline section, headed by its h2", () => {
    const { container } = renderPipeline();
    const section = container.querySelector("section#pipeline")!;
    expect(section).not.toBeNull();
    expect(section).toHaveAttribute("aria-labelledby", "pipeline-heading");
    expect(screen.getByRole("heading", { level: 2, name: "How the projects reach this page" })).toBeInTheDocument();
  });

  it("gives this site's own project number in the intro", () => {
    const { container } = renderPipeline();
    const n = projectNumber("portfolio-v2");
    expect(n).toMatch(/^\d\d$/);
    expect(container.querySelector(".section-intro")).toHaveTextContent(`This site is project ${n}.`);
  });

  it("wraps the content in a stage inside the scroll track", () => {
    const { container } = renderPipeline();
    const stage = container.querySelector(".pipeline-stage")!;
    expect(stage.parentElement).toHaveClass("pipeline-track");
    expect(stage.querySelector(".pipeline-inner #pipeline-heading")).not.toBeNull();
  });

  it("hides the drawing from assistive technology and lists the same steps instead", () => {
    const { container } = renderPipeline();
    expect(container.querySelector(".pl-diagram")).toHaveAttribute("aria-hidden", "true");
    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(PIPELINE_NODES.length);
    items.forEach((item, i) => {
      expect(item).toHaveTextContent(PIPELINE_NODES[i].label);
      expect(item).toHaveTextContent(PIPELINE_NODES[i].text);
      expect(item).toHaveTextContent(PIPELINE_NODES[i].source);
    });
    const note = list.nextElementSibling!;
    expect(note).toHaveTextContent(PRERENDER_ROUTE.text);
    expect(note).toHaveTextContent(CI_CHECK.text);
  });

  it("shows every citation under its node", () => {
    const { container } = renderPipeline();
    const cites = Array.from(container.querySelectorAll(".pl-nodes .pl-cite")).map((c) =>
      c.textContent!.replace(/\u200b/g, ""),
    );
    expect(cites).toEqual(PIPELINE_NODES.map((n) => n.source));
  });

  it("renders the finished diagram outside the pinned layout", () => {
    const { container } = renderPipeline();
    const on = Array.from(container.querySelectorAll(".pl-node")).map((n) => n.getAttribute("data-on"));
    expect(on).toEqual(PIPELINE_NODES.map(() => "true"));
    expect(container.querySelector(".pl-route")).toHaveAttribute("data-on", "true");
    expect(container.querySelector(".pl-ci")).toHaveAttribute("data-on", "true");
  });

  it("starts the drawing unlit once the pinned layout takes over", async () => {
    media = installMatchMedia([PIN_QUERY]);
    const { container } = renderPipeline();
    await act(async () => {});
    // jsdom never scrolls, so the drawing sits at the start of its track.
    const on = Array.from(container.querySelectorAll(".pl-node")).map((n) => n.getAttribute("data-on"));
    expect(on).toEqual(PIPELINE_NODES.map(() => "false"));
    expect(container.querySelector(".pl-route")).toHaveAttribute("data-on", "false");
    expect(container.querySelector(".pl-ci")).toHaveAttribute("data-on", "false");
    // The text is still all there for anyone reading the list.
    expect(screen.getByRole("list")).toHaveTextContent(PIPELINE_NODES[4].text);
  });
});
