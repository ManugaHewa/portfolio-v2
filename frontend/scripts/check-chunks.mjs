// CI check (not part of the build): each built page loads only the code it
// needs; the privacy page gets no animation or WebGL code.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");

const assets = (page) =>
  [...readFileSync(resolve(DIST, page), "utf8").matchAll(/(?:src|href)="\/assets\/([^"]+)"/g)].map((m) => m[1]);

// Chunk imports, so indirect loads are caught too.
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

// Library fingerprints, in case a library lands in an unexpectedly named chunk.
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
