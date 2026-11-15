import { describe, it, expect } from "vitest";
import { formatSummary, pageOf, parseLine, summarise, type Hit } from "../lib/visits.js";

// The anonymised format (deploy/nginx/portfolio.conf) and Nginx's default "combined" one.
const anon = (addr: string, day: string, path: string, status = 200, method = "GET") =>
  `${addr} [${day}/Nov/2026:10:34:50 -0500] "${method} ${path} HTTP/1.1" ${status} 5120`;
const combined = (agent: string, path = "/") =>
  `127.0.0.1 - - [15/Nov/2026:10:34:50 -0500] "GET ${path} HTTP/1.1" 200 5120 "-" "${agent}"`;

const parse = (lines: string[]) => lines.map(parseLine).filter((h): h is Hit => h !== null);

describe("visit counts", () => {
  it("reads both log formats", () => {
    expect(parseLine(anon("203.0.113.0", "15", "/work/rxflow/"))).toEqual({
      addr: "203.0.113.0", day: "2026-11-15", method: "GET", path: "/work/rxflow/", status: 200, agent: null,
    });
    expect(parseLine(combined("Mozilla/5.0"))?.agent).toBe("Mozilla/5.0");
    expect(parseLine("garbage")).toBeNull();
  });

  it("counts pages only: not assets, API calls, errors, HEAD requests or named bots", () => {
    const page = (line: string) => pageOf(parseLine(line) as Hit);
    expect(page(anon("a", "15", "/"))).toBe("/");
    expect(page(anon("a", "15", "/privacy"))).toBe("/privacy/");
    expect(page(anon("a", "15", "/work/rxflow?ref=x"))).toBe("/work/rxflow/");
    expect(page(anon("a", "15", "/assets/main.js"))).toBeNull();
    expect(page(anon("a", "15", "/api/projects"))).toBeNull();
    expect(page(anon("a", "15", "/wp-admin", 404))).toBeNull();
    expect(page(anon("a", "15", "/", 200, "HEAD"))).toBeNull();
    expect(page(combined("Googlebot/2.1"))).toBeNull();
  });

  it("sums views and distinct addresses per day, and ranks pages", () => {
    const s = summarise(
      parse([
        anon("203.0.113.0", "14", "/"),
        anon("203.0.113.0", "15", "/"),
        anon("203.0.113.0", "15", "/work/rxflow/"),
        anon("198.51.100.0", "15", "/"),
        anon("198.51.100.0", "15", "/assets/main.js"),
      ]),
    );
    expect(s.days).toEqual([
      { day: "2026-11-14", views: 1, visitors: 1 },
      { day: "2026-11-15", views: 3, visitors: 2 },
    ]);
    expect(s.pages).toEqual([["/", 3], ["/work/rxflow/", 1]]);
    expect(s.oneAddress).toBe(false);
    expect(formatSummary(s)).toContain("Total            4");
  });

  it("says when every view has one address (the old config), instead of counting visitors", () => {
    const s = summarise(parse([combined("Mozilla/5.0"), combined("Mozilla/5.0", "/privacy")]));
    expect(s.oneAddress).toBe(true);
    expect(formatSummary(s)).toContain("Visitors can't be counted");
  });
});
