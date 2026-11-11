import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// From the import.meta.url string, never through `new URL()`: under jsdom the
// global URL is jsdom's, and Node's fileURLToPath rejects its objects.
const FRONTEND = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (path: string) => readFileSync(join(FRONTEND, path), "utf8");
const ORIGIN = "https://manugahewa.dev";

function head(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const meta = (selector: string) => doc.querySelector(selector)?.getAttribute("content") ?? null;
  return { doc, meta };
}

describe("the home page's head", () => {
  const { doc, meta } = head(read("index.html"));

  it("has a title and description naming the person, the role and the place", () => {
    expect(doc.title).toMatch(/Manuga Hewa Pathirana/);
    expect(doc.title).toMatch(/full-stack developer/i);
    expect(meta('meta[name="description"]')).toMatch(/Milton, Ontario/);
  });

  it("points every URL at the real domain", () => {
    // The old tags pointed at a github.io address and a missing og.png.
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(`${ORIGIN}/`);
    expect(meta('meta[property="og:url"]')).toBe(`${ORIGIN}/`);
    expect(meta('meta[property="og:image"]')).toBe(`${ORIGIN}/og.png`);
    expect(meta('meta[name="twitter:image"]')).toBe(`${ORIGIN}/og.png`);
    // Attribute values only: the HTML comments mention the old address.
    const urls = [...doc.head.querySelectorAll("[content], [href]")].map(
      (el) => el.getAttribute("content") ?? el.getAttribute("href") ?? "",
    );
    expect(urls.filter((url) => url.includes("github.io"))).toEqual([]);
  });

  it("describes the share image, which exists at the advertised size", () => {
    expect(meta('meta[property="og:image:width"]')).toBe("1200");
    expect(meta('meta[property="og:image:height"]')).toBe("630");
    expect(meta('meta[property="og:image:alt"]')).toBeTruthy();
    expect(meta('meta[name="twitter:card"]')).toBe("summary_large_image");

    const png = readFileSync(join(FRONTEND, "public/og.png"));
    // Width and height sit at bytes 16-23 of a PNG's IHDR chunk.
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });

  it("carries Person structured data that parses", () => {
    const block = doc.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(block?.textContent ?? "{}");

    expect(data["@type"]).toBe("Person");
    expect(data.name).toBe("Manuga Hewa Pathirana");
    expect(data.url).toBe(`${ORIGIN}/`);
    expect(data.sameAs).toContain("https://github.com/ManugaHewa");
  });
});

describe("the home page without JavaScript", () => {
  const html = read("index.html");

  it("reveals only the entrances marked data-reveal", () => {
    // The old block sniffed inline styles ([style*="opacity:0"] and the
    // like), which also un-hid things meant to stay hidden.
    const block = html.match(/<noscript>([\s\S]*?)<\/noscript>/)?.[1] ?? "";
    const rules = [...block.matchAll(/([^{}]+)\{/g)].map((m) => m[1].replace(/<style>/, "").trim());
    expect(rules).toEqual(["[data-reveal]"]);
    expect(block).toMatch(/opacity:\s*1\s*!important/);
    expect(block).toMatch(/transform:\s*none\s*!important/);
  });

  it("loads no font from another origin", () => {
    // The fonts are bundled and served from this site (CSP font-src 'self').
    expect(html).not.toMatch(/fonts\.(googleapis|gstatic)\.com|use\.typekit|fonts\.bunny/);
  });
});

describe("the privacy page's head", () => {
  const { doc } = head(read("privacy/index.html"));

  it("has its own title and canonical URL", () => {
    expect(doc.title).toMatch(/^Privacy/);
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(`${ORIGIN}/privacy`);
  });
});

describe("crawler files", () => {
  it("robots.txt points at the sitemap and keeps crawlers out of the API", () => {
    const robots = read("public/robots.txt");
    expect(robots).toMatch(/^Sitemap: https:\/\/manugahewa\.dev\/sitemap\.xml$/m);
    expect(robots).toMatch(/^Disallow: \/api\/$/m);
  });

  it("the sitemap lists each page by its canonical URL", () => {
    const locs = [...read("public/sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual([`${ORIGIN}/`, `${ORIGIN}/privacy`]);
  });
});
