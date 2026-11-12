import { useRef } from "react";
import type { CSSProperties } from "react";
import { COMMIT_DAYS } from "virtual:commit-log";
import { useMotionAllowed, useReplayInView } from "../motion";
import { cx } from "../lib/cx";

const DAY_MS = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const utc = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const label = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

export interface CommitGrid {
  /** One entry per day from the Sunday before the first commit to the last commit's day. */
  cells: Array<{ day: string; count: number; level: 0 | 1 | 2 | 3 | 4; week: number; weekday: number }>;
  weeks: number;
  total: number;
  activeDays: number;
  first: string;
  last: string;
}

/**
 * The calendar grid from commits per day: a column per week, a row per
 * weekday, and each day's shade one of four steps of the busiest day.
 * Pure, from the build-time log, so the server and the browser draw the
 * same grid.
 */
export function commitGrid(days: ReadonlyArray<readonly [string, number]>): CommitGrid | null {
  if (days.length === 0) return null;
  const counts = new Map(days);
  const first = days[0][0];
  const last = days[days.length - 1][0];
  const startDay = new Date(utc(first)).getUTCDay();
  const start = utc(first) - startDay * DAY_MS;
  const max = Math.max(...days.map(([, n]) => n));
  const cells: CommitGrid["cells"] = [];
  for (let t = start, i = 0; t <= utc(last); t += DAY_MS, i++) {
    const day = new Date(t).toISOString().slice(0, 10);
    const count = counts.get(day) ?? 0;
    const level = (count === 0 ? 0 : Math.min(4, Math.ceil((count / max) * 4))) as 0 | 1 | 2 | 3 | 4;
    cells.push({ day, count, level, week: Math.floor(i / 7), weekday: i % 7 });
  }
  return {
    cells,
    weeks: Math.floor((cells.length - 1) / 7) + 1,
    total: days.reduce((sum, [, n]) => sum + n, 0),
    activeDays: days.length,
    first,
    last,
  };
}

const GRID = commitGrid(COMMIT_DAYS);

/**
 * This repository's history as a heatmap, under the pipeline: every
 * commit that went into the page you are reading, by day, from git at
 * build time (frontend/build/repoFacts.ts). The numbers in the caption are
 * counted from the same log.
 *
 * The prerendered grid is complete. With motion allowed it fills in a week
 * at a time each time it is scrolled down to (useReplayInView); otherwise it
 * is simply there. One image to assistive technology, named by the caption.
 */
export function CommitStrip({ grid = GRID }: { grid?: CommitGrid | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const allowed = useMotionAllowed();
  const shown = useReplayInView(ref, 0.4);
  if (!grid) return null;

  const summary = `${grid.total} commits on ${grid.activeDays} days, ${label(grid.first)} to ${label(grid.last)}`;

  return (
    <div className="commit-strip container">
      <p className="live-readout-title mono">This repository, commit by commit</p>
      <div
        ref={ref}
        className={cx("commit-grid", allowed && !shown && "is-armed")}
        style={{ "--weeks": grid.weeks } as CSSProperties}
        role="img"
        aria-label={summary}
      >
        {grid.cells.map((c) => (
          <span
            key={c.day}
            className="commit-cell"
            data-level={c.level}
            style={{ gridColumn: c.week + 1, gridRow: c.weekday + 1, "--c": c.week } as CSSProperties}
            title={`${label(c.day)}: ${c.count} ${c.count === 1 ? "commit" : "commits"}`}
          />
        ))}
      </div>
      <p className="commit-caption small" aria-hidden="true">
        {summary}
      </p>
    </div>
  );
}
