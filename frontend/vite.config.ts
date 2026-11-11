import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const page = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react()],
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
                  test: /[\\/]node_modules[\\/](framer-motion|motion-dom|motion-utils|gsap|lenis)[\\/]/,
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
