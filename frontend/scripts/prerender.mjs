// Writes the rendered pages into the built HTML, the last step of
// `npm run build`. Without it, the HTML body is an empty <div id="root">
// until JavaScript runs, so crawlers, link previews and anyone without
// JavaScript saw a page with no name and no projects in it.
//
//   dist/index.html          home page, plus the project list it was
//                            rendered with, for hydration to start from
//   dist/privacy/index.html  privacy page
//   dist/404.html            served by Nginx with a 404 status; no script
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const FRONTEND = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = resolve(FRONTEND, "dist");
const ROOT = '<div id="root"></div>';

const server = await import(pathToFileURL(resolve(FRONTEND, "dist-server/entry-server.js")).href);

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
  fill(homeTemplate, home.html, `\n    <script id="initial-projects" type="application/json">${data}</script>`),
);

const privacyFile = resolve(DIST, "privacy/index.html");
writeFileSync(privacyFile, fill(readFileSync(privacyFile, "utf8"), server.renderPrivacy()));

// 404: a document of its own rather than the home template with pieces cut
// out. It borrows the built stylesheet and the favicon, and nothing else.
const stylesheets = homeTemplate.match(/<link rel="stylesheet"[^>]*>/g) ?? [];
// Up to the closing quote, not the first ">": the favicon is an inline SVG,
// and cutting at its first ">" left an open attribute that swallowed the
// stylesheet link after it.
const favicon = homeTemplate.match(/<link rel="icon" href="[^"]*"\s*\/?>/)?.[0] ?? "";
if (stylesheets.length === 0) throw new Error("No stylesheet link found in the built index.html");
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
  `prerendered: index.html (${home.projects.length} projects), privacy/index.html, 404.html`,
);
