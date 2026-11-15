/**
 * Page views from Nginx access log lines. Reads both the anonymised format
 * (deploy/nginx/portfolio.conf) and Nginx's default "combined" format.
 */
export interface Hit {
  addr: string;
  /** YYYY-MM-DD, the server's local date. */
  day: string;
  method: string;
  path: string;
  status: number;
  /** User agent; only the combined format has one. */
  agent: string | null;
}

const LINE = /^(\S+)(?: \S+ \S+)? \[(\d{2})\/(\w{3})\/(\d{4}):[^\]]*\] "(\S+) (\S+)[^"]*" (\d{3}) \S+(?: "[^"]*" "([^"]*)")?/;
const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

export function parseLine(line: string): Hit | null {
  const m = LINE.exec(line);
  if (!m || !MONTHS[m[3]]) return null;
  return {
    addr: m[1],
    day: `${m[4]}-${MONTHS[m[3]]}-${m[2]}`,
    method: m[5],
    path: m[6],
    status: Number(m[7]),
    agent: m[8] ?? null,
  };
}

// The site's pages: home, privacy and each case study.
const PAGE = /^\/(?:privacy\/?|work\/[a-z0-9-]+\/?)?$/;
const BOT = /bot|crawl|spider|slurp|preview|monitor|curl|wget|python|headless|http-client|scan/i;

/** The page a hit counts as, or null if it is not a page view (assets, API, errors, bots that say so). */
export function pageOf(hit: Hit): string | null {
  if (hit.method !== "GET" || (hit.status !== 200 && hit.status !== 304)) return null;
  if (hit.agent && BOT.test(hit.agent)) return null;
  const path = hit.path.split("?")[0];
  if (!PAGE.test(path)) return null;
  return path === "/" || path.endsWith("/") ? path : `${path}/`;
}

export interface Summary {
  days: Array<{ day: string; views: number; visitors: number }>;
  pages: Array<[string, number]>;
  /** Every view came from one address (the old config logs only 127.0.0.1), so visitors cannot be counted. */
  oneAddress: boolean;
}

export function summarise(hits: Iterable<Hit>): Summary {
  const byDay = new Map<string, { views: number; addrs: Set<string> }>();
  const pages = new Map<string, number>();
  const addrs = new Set<string>();
  for (const hit of hits) {
    const page = pageOf(hit);
    if (!page) continue;
    const day = byDay.get(hit.day) ?? { views: 0, addrs: new Set<string>() };
    day.views += 1;
    day.addrs.add(hit.addr);
    byDay.set(hit.day, day);
    pages.set(page, (pages.get(page) ?? 0) + 1);
    addrs.add(hit.addr);
  }
  return {
    days: [...byDay].sort(([a], [b]) => a.localeCompare(b)).map(([day, d]) => ({ day, views: d.views, visitors: d.addrs.size })),
    pages: [...pages].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    oneAddress: addrs.size === 1 && [...byDay.values()].some((d) => d.views > 1),
  };
}

/** The summary as terminal text. */
export function formatSummary({ days, pages, oneAddress }: Summary, topPages = 10): string {
  if (days.length === 0) return "No page views in these logs.";
  const total = days.reduce((n, d) => n + d.views, 0);
  const rows = days.map((d) => `${d.day}  ${String(d.views).padStart(6)}  ${oneAddress ? "     -" : String(d.visitors).padStart(8)}`);
  const width = Math.max(...pages.slice(0, topPages).map(([p]) => p.length));
  const top = pages.slice(0, topPages).map(([p, n]) => `  ${p.padEnd(width)}  ${String(n).padStart(6)}`);
  return [
    `Page views, ${days[0].day} to ${days[days.length - 1].day}`,
    "",
    "Day          Views  Visitors",
    ...rows,
    `Total       ${String(total).padStart(6)}`,
    "",
    "Most viewed",
    ...top,
    "",
    oneAddress
      ? "Visitors can't be counted: every request has the same address. The new Nginx config (docs/manual-steps.md section 1) logs real, anonymised ones."
      : "Visitors are distinct anonymised addresses per day, so people on one network count once. Bots that don't name themselves are included.",
  ].join("\n");
}
