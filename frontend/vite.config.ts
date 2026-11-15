import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { defineConfig, transformWithOxc, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { repoFacts } from "./build/repoFacts.ts";
import { previewApi } from "./build/previewApi.ts";
import { resumeStamp } from "./build/resume.ts";

const page = (path: string) => fileURLToPath(new URL(path, import.meta.url));

const PROJECT_INDEX_ID = "virtual:project-index";
const PROJECTS_FILE = page("../content/projects.ts");

/** Project fields src/stats.ts reads. */
const INDEX_FIELDS = ["slug", "title", "tier", "stack"] as const;

/**
 * Serves `virtual:project-index`: just the fields stats.ts needs, so the
 * case studies' full text stays out of the main bundle. The content file is
 * evaluated (loadContent) rather than imported: the config loader would
 * bundle it as CommonJS, and Node 20 cannot import TypeScript.
 */
function projectIndex(): Plugin {
  // \0 marks a virtual module, so no plugin reads it from disk.
  const resolved = "\0" + PROJECT_INDEX_ID;
  return {
    name: "project-index",
    resolveId(id) {
      return id === PROJECT_INDEX_ID ? resolved : undefined;
    },
    async load(id) {
      if (id !== resolved) return undefined;
      this.addWatchFile(PROJECTS_FILE);
      const content = await loadContent();
      const rows = content.PROJECTS.map((p) =>
        Object.fromEntries(INDEX_FIELDS.map((field) => [field, p[field]])),
      );
      return `export const PROJECTS = ${JSON.stringify(rows)};\n`;
    },
  };
}

/** content/projects.ts, type-stripped and evaluated from a data: URL; re-read each time for dev edits. */
async function loadContent() {
  const source = await readFile(PROJECTS_FILE, "utf8");
  const { code } = await transformWithOxc(source, PROJECTS_FILE);
  return (await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`)) as {
    PROJECTS: Array<Record<string, unknown> & { slug: string }>;
    projectSummaries(): unknown[];
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Build commit for the live readout: short hash and committer date,
 * formatted here ("11 Nov 2026") so every time zone prints the same. Null without git.
 */
export function buildStamp(): { commit: string; date: string } | null {
  try {
    // No shell: cmd.exe would treat "|" as a pipe.
    const [commit, iso] = execFileSync("git", ["log", "-1", "--format=%h|%cI"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .split("|");
    const [y, mo, d] = iso.slice(0, 10).split("-").map(Number);
    if (!commit || !y || !mo || !d) return null;
    return { commit, date: `${d} ${MONTHS[mo - 1]} ${y}` };
  } catch {
    return null;
  }
}

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react(), projectIndex(), ...repoFacts(), previewApi(loadContent)],
  define: {
    __BUILD__: JSON.stringify(buildStamp()),
    __RESUME__: JSON.stringify(resumeStamp()),
  },
  // The SSR prerender bundles every dependency into one file.
  ssr: { noExternal: true },
  build: isSsrBuild
    ? {}
    : {
        // Fonts always as files: the CSP's font-src 'self' blocks data: URIs.
        assetsInlineLimit: (file: string) => (/\.woff2?$/.test(file) ? false : undefined),
        rolldownOptions: {
          // Two entries; the privacy page loads no animation or WebGL code.
          input: {
            main: page("./index.html"),
            privacy: page("./privacy/index.html"),
          },
          output: {
            // Vendor chunks, so app edits don't invalidate React or Motion
            // caches. Three stays its own lazy chunk. Matched by path (a name
            // list missed React's JSX runtime); React's higher priority keeps
            // it out of the motion chunk. scripts/check-chunks.mjs guards this.
            codeSplitting: {
              groups: [
                {
                  name: "react",
                  test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
                  priority: 2,
                },
                {
                  name: "motion",
                  test: /[\\/]node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/,
                  priority: 1,
                },
              ],
            },
          },
        },
      },
  server: {
    proxy: {
      // Same-origin /api in dev, as Nginx provides in production.
      "/api": "http://localhost:4000",
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
}));
