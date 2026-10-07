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
        rollupOptions: {
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
            // Matched by path rather than listed by package name. The list form
            // missed React's JSX runtime (a CommonJS file reached through a proxy
            // module), so it landed in the motion chunk, framer-motion being the
            // first thing to import it - and every page, the privacy page
            // included, then had to download the animation libraries to render.
            manualChunks(id: string) {
              if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "react";
              if (/[\\/]node_modules[\\/](framer-motion|motion-dom|motion-utils|gsap|lenis)[\\/]/.test(id)) {
                return "motion";
              }
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
