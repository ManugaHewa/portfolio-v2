import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { defineConfig, transformWithOxc, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { repoFacts } from "./build/repoFacts.ts";
import { previewApi } from "./build/previewApi.ts";

const page = (path: string) => fileURLToPath(new URL(path, import.meta.url));

const PROJECT_INDEX_ID = "virtual:project-index";
const PROJECTS_FILE = page("../content/projects.ts");

/** The fields of a project that src/stats.ts reads (see projectIndex). */
const INDEX_FIELDS = ["slug", "title", "tier", "category", "status", "stack"] as const;

/**
 * Serves `virtual:project-index`: the few fields of each project that the
 * page's numbers, project numbering and tech band are derived from
 * (src/stats.ts), in content order. Importing content/projects.ts itself
 * would ship every case study's full copy in the main bundle, though the
 * page already gets that copy from the prerendered HTML and the API.
 *
 * The file is read, stripped of its types and evaluated here, at dev and
 * build time, rather than imported by this config: the config loader would
 * bundle it as CommonJS (the repo root has no "type": "module") and warn on
 * every run, and Node 20, which CI uses, cannot import TypeScript itself.
 * Evaluated from a data: URL, it can have no imports of its own; it has none.
 * The same plugin serves the dev server, both builds and Vitest, and the
 * watch on the file means an edit to it reloads the module in dev.
 */
function projectIndex(): Plugin {
  // The \0 prefix is the convention that marks a virtual module, so no
  // other plugin tries to read it from disk.
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

/**
 * content/projects.ts, read, stripped of its types and evaluated (see
 * projectIndex for why it is not imported). Read afresh each time, so an
 * edit during `vite dev` is picked up.
 */
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
 * The commit this build was made from, for the live readout in the pipeline
 * section: its short hash and its date as the committer wrote it, formatted
 * here ("11 Nov 2026") so the prerendered page and the browser print the
 * same string whatever their time zones. scripts/deploy.sh builds from a git
 * checkout, so in production this is the deployed commit. Null wherever git
 * is not available, and the readout then leaves the item out.
 */
export function buildStamp(): { commit: string; date: string } | null {
  try {
    // No shell: on Windows cmd.exe would read the "|" as a pipe.
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
  },
  // The build-time prerender (`vite build --ssr src/entry-server.tsx`, run by
  // `npm run build`) bundles every dependency into its one output file rather
  // than leaving Node to resolve the animation libraries' ESM builds itself.
  ssr: { noExternal: true },
  build: isSsrBuild
    ? {}
    : {
        // Fonts always as files. Vite inlines small assets as data: URIs, and
        // the CSP's font-src 'self' (deploy/nginx/portfolio.conf) blocks a
        // font loaded that way, which it did for the smallest subsets.
        assetsInlineLimit: (file: string) => (/\.woff2?$/.test(file) ? false : undefined),
        rolldownOptions: {
          // Two pages, each with its own entry: the privacy page shares the React
          // chunk and loads none of the animation or WebGL code.
          input: {
            main: page("./index.html"),
            privacy: page("./privacy/index.html"),
          },
          output: {
            // React, the animation libraries and the app's own code changed at very
            // different rates but shipped as one 474 kB file, so editing a single
            // component invalidated the whole thing in every returning visitor's
            // cache. Splitting them means app edits re-download only app code, and
            // the browser fetches the two in parallel on a first visit.
            //
            // Three is deliberately absent: it is already its own lazy chunk and
            // naming it here would pull it back into the static graph.
            //
            // Matched by path rather than listed by package name: a name list
            // missed React's JSX runtime (a CommonJS file reached through a proxy
            // module). Two groups, React first, rather than the manualChunks
            // function this used under Rollup: Rolldown turns that function into
            // one group, a group takes its modules' dependencies with it, and
            // React (which framer-motion imports) ended up in the motion chunk,
            // so every page, the privacy page included, had to download the
            // animation libraries to render. The priorities make React's claim
            // win regardless of order; scripts/check-chunks.mjs, run by CI after
            // the build, fails if the privacy page loads motion or WebGL code.
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
      // Lets the frontend call `/api/...` in dev without CORS juggling. In
      // production Nginx serves the pages and proxies /api from one origin
      // (deploy/nginx/portfolio.conf), so it is same-origin there too.
      "/api": "http://localhost:4000",
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
}));
