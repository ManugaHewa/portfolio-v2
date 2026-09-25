import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // React, the animation libraries and the app's own code changed at very
        // different rates but shipped as one 474 kB file, so editing a single
        // component invalidated the whole thing in every returning visitor's
        // cache. Splitting them means app edits re-download only app code, and
        // the browser fetches the two in parallel on a first visit.
        //
        // Three is deliberately absent: it is already its own lazy chunk and
        // naming it here would pull it back into the static graph.
        manualChunks: {
          react: ["react", "react-dom"],
          motion: ["framer-motion", "gsap", "gsap/ScrollTrigger", "lenis"],
        },
      },
    },
  },
  server: {
    proxy: {
      // Lets the frontend call `/api/...` in dev without CORS juggling;
      // in production these are separate deployed services (see README).
      "/api": "http://localhost:4000",
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
});
