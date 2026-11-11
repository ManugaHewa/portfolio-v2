// Checks the built pages load only the code they need. Run by CI after
// `npm run build`; not part of the build itself, so a failure here turns CI
// red without stopping a deploy.
//
// The privacy page renders no animation, but twice now a bundler change has
// put React into the animation chunk and made every page download it: first
// React's JSX runtime under Rollup's manualChunks, then all of React under
// Rolldown's dependency-capturing groups (see vite.config.ts).
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");

const assets = (page) =>
  [...readFileSync(resolve(DIST, page), "utf8").matchAll(/(?:src|href)="\/assets\/([^"]+)"/g)].map((m) => m[1]);

// What each chunk imports, so a chunk pulled in indirectly is caught too.
const imports = (file) =>
  [...readFileSync(resolve(DIST, "assets", file), "utf8").matchAll(/from"\.\/([^"]+\.js)"/g)].map((m) => m[1]);

function reachable(page) {
  const seen = new Set();
  const queue = assets(page).filter((f) => f.endsWith(".js"));
  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    queue.push(...imports(file));
  }
  return [...seen];
}

// Fingerprints of the two libraries, for a library that lands in a chunk the
// names below do not expect (a bundler change could fold framer-motion into
// the page's own chunk, and the name check alone would pass). Each string is
// in that library's code and in nothing else this site ships.
const FRAMER_MOTION = "framerAppearId";
const THREE = "WebGLRenderer";
const contains = (file, text) => readFileSync(resolve(DIST, "assets", file), "utf8").includes(text);

const failures = [];
const chunks = readdirSync(resolve(DIST, "assets"));
if (!chunks.some((f) => /^react-.*\.js$/.test(f))) failures.push("no react chunk was built");
if (!chunks.some((f) => /^motion-.*\.js$/.test(f))) failures.push("no motion chunk (framer-motion) was built");
if (!chunks.some((f) => /^Scene3D-.*\.js$/.test(f))) failures.push("no Scene3D chunk was built");

for (const file of reachable("privacy/index.html")) {
  if (/^(motion|Scene3D)-/.test(file)) failures.push(`privacy/index.html loads ${file}`);
  else if (contains(file, FRAMER_MOTION)) failures.push(`privacy/index.html loads framer-motion inside ${file}`);
  else if (contains(file, THREE)) failures.push(`privacy/index.html loads Three.js inside ${file}`);
}

if (failures.length > 0) {
  console.error(`check-chunks: ${failures.join("; ")}`);
  process.exit(1);
}
console.log("check-chunks: the privacy page loads neither framer-motion nor the Scene3D (Three.js) chunk");
