// Last step of `npm run build`: writes rendered HTML into the pages.
//
//   dist/index.html          home page, plus its project list for hydration
//   dist/privacy/index.html  privacy page
//   dist/404.html            static, no script
//   dist/work/<slug>/        each case study's page, no script
//   dist/sitemap.xml         every page but the 404
//
// Each head also preloads the Latin Mona Sans file.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const FRONTEND = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = resolve(FRONTEND, "dist");
const ROOT = '<div id="root"></div>';

const server = await import(pathToFileURL(resolve(FRONTEND, "dist-server/entry-server.js")).href);

// Hashed name, so found in the build: Latin, width axis, upright.
const monaSans = readdirSync(resolve(DIST, "assets")).find((f) =>
  /^mona-sans-latin-wdth-normal-[\w-]+\.woff2$/.test(f),
);
if (!monaSans) throw new Error("No mona-sans-latin-wdth-normal .woff2 found in dist/assets");
// crossorigin: fonts load in CORS mode, so a preload without it is fetched twice.
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

// Home: markup plus its data as a JSON block (not executed, so the CSP allows
// it); "<" is escaped so the data cannot close the script element.
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

// 404: its own document with the privacy stylesheet and the favicon.
const stylesheets = privacyTemplate.match(/<link rel="stylesheet"[^>]*>/g) ?? [];
// Match to the closing quote: the inline SVG favicon contains ">".
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
    <meta name="theme-color" content="#08090b" />
    ${favicon}
    ${stylesheets.join("\n    ")}
  </head>
  <body>
    <div id="root">${server.renderNotFound()}</div>
  </body>
</html>
`,
);

// Project pages: like the 404, plus title, description, canonical and link preview.
const SITE_URL = "https://manugahewa.dev";
const attr = (text) =>
  text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const appleIcon = homeTemplate.match(/<link rel="apple-touch-icon" href="[^"]*"\s*\/?>/)?.[0] ?? "";
const cases = server.renderCaseStudies();
for (const c of cases) {
  const url = `${SITE_URL}/work/${c.slug}/`;
  const title = `${c.title} | Case study | Manuga Hewa Pathirana`;
  const dir = resolve(DIST, "work", c.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    resolve(dir, "index.html"),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <title>${attr(title)}</title>
    ${FONT_PRELOAD}
    <meta name="description" content="${attr(c.subtitle)}" />
    <link rel="canonical" href="${url}" />
    <meta name="theme-color" content="#08090b" />
    ${favicon}
    ${appleIcon}
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Manuga Hewa Pathirana" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${attr(`${c.title}, a case study by Manuga Hewa Pathirana`)}" />
    <meta property="og:description" content="${attr(c.subtitle)}" />
    <meta property="og:image" content="${SITE_URL}/og.png" />
    <meta name="twitter:card" content="summary_large_image" />
    ${stylesheets.join("\n    ")}
  </head>
  <body>
    <div id="root">${c.html}</div>
  </body>
</html>
`,
  );
}

// Sitemap of the pages written.
const pages = ["/", "/privacy", ...cases.map((c) => `/work/${c.slug}/`)];
writeFileSync(
  resolve(DIST, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url>\n    <loc>${SITE_URL}${p}</loc>\n  </url>`).join("\n")}
</urlset>
`,
);

console.log(
  `prerendered: index.html (${home.projects.length} projects), privacy/index.html, 404.html, ${cases.length} case study pages, sitemap.xml; preloading ${monaSans}`,
);
