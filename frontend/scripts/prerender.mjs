// Writes the rendered pages into the built HTML, the last step of
// `npm run build`. Without it, the HTML body is an empty <div id="root">
// until JavaScript runs, so crawlers, link previews and anyone without
// JavaScript saw a page with no name and no projects in it.
//
//   dist/index.html          home page, plus the project list it was
//                            rendered with, for hydration to start from
//   dist/privacy/index.html  privacy page
//   dist/404.html            served by Nginx with a 404 status; no script
//
// Every page's head also gets a preload for the Latin Mona Sans file, so the
// browser fetches the main typeface alongside the stylesheet rather than only
// once it has parsed it, and the swap from the fallback face comes sooner.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const FRONTEND = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = resolve(FRONTEND, "dist");
const ROOT = '<div id="root"></div>';

const server = await import(pathToFileURL(resolve(FRONTEND, "dist-server/entry-server.js")).href);

// The file name carries Vite's content hash, so it is looked up in the build
// rather than written here. Latin, width axis, upright: the one file every
// page needs for its own text.
const monaSans = readdirSync(resolve(DIST, "assets")).find((f) =>
  /^mona-sans-latin-wdth-normal-[\w-]+\.woff2$/.test(f),
);
if (!monaSans) throw new Error("No mona-sans-latin-wdth-normal .woff2 found in dist/assets");
// crossorigin even though the font is same-origin: fonts are always fetched
// in CORS mode, and a preload without it is not reused, so the file would be
// downloaded twice.
const FONT_PRELOAD = `<link rel="preload" as="font" type="font/woff2" crossorigin href="/assets/${monaSans}" />`;

function withPreload(page) {
  if (!page.includes("</title>")) throw new Error("Expected a <title> to place the font preload after");
  return page.replace("</title>", `</title>\n    ${FONT_PRELOAD}`);
}

function fill(template, html, after = "") {
  const parts = template.split(ROOT);
  if (parts.length !== 2) {
    throw new Error(`Expected exactly one ${ROOT} in the built template, found ${parts.length - 1}`);
  }
  return parts[0] + `<div id="root">${html}</div>` + after + parts[1];
}

// Home: the markup, then the data it was rendered from. A JSON data block is
// never executed, so the CSP's script-src does not apply to it. "<" is escaped
// so no string in the data can close the script element early.
const homeTemplate = readFileSync(resolve(DIST, "index.html"), "utf8");
const home = server.renderHome();
const data = JSON.stringify(home.projects).replace(/</g, "\\u003c");
writeFileSync(
  resolve(DIST, "index.html"),
  withPreload(
    fill(homeTemplate, home.html, `\n    <script id="initial-projects" type="application/json">${data}</script>`),
  ),
);

const privacyFile = resolve(DIST, "privacy/index.html");
const privacyTemplate = readFileSync(privacyFile, "utf8");
writeFileSync(privacyFile, withPreload(fill(privacyTemplate, server.renderPrivacy())));

// 404: a document of its own rather than a template with pieces cut out. It
// borrows the privacy page's stylesheet, which covers the header, the footer
// and the reading column without the home page's sections, plus the favicon,
// and nothing else.
const stylesheets = privacyTemplate.match(/<link rel="stylesheet"[^>]*>/g) ?? [];
// Up to the closing quote, not the first ">": the favicon is an inline SVG,
// and cutting at its first ">" left an open attribute that swallowed the
// stylesheet link after it.
const favicon = homeTemplate.match(/<link rel="icon" href="[^"]*"\s*\/?>/)?.[0] ?? "";
if (stylesheets.length === 0) throw new Error("No stylesheet link found in the built privacy/index.html");
writeFileSync(
  resolve(DIST, "404.html"),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="robots" content="noindex" />
    <title>Page not found | Manuga Hewa Pathirana</title>
    ${FONT_PRELOAD}
    <meta name="theme-color" content="#0d1518" />
    ${favicon}
    ${stylesheets.join("\n    ")}
  </head>
  <body>
    <div id="root">${server.renderNotFound()}</div>
  </body>
</html>
`,
);

console.log(
  `prerendered: index.html (${home.projects.length} projects), privacy/index.html, 404.html; preloading ${monaSans}`,
);
