import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

/*
 * Facts about this repository, read at build time and served to the page
 * as virtual modules, so what the page shows about its own code is the code
 * itself, as it stood when the page was built:
 *
 * - virtual:code-peeks: the lines behind each step of the pipeline diagram,
 *   tokenised for highlighting.
 * - virtual:commit-log: how many commits landed on each day.
 */

// From the module's own path rather than `new URL()`, which jsdom's URL
// (in the tests) cannot resolve against a file: URL.
const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * The excerpt each pipeline step opens, keyed by the step's cited source.
 * `find` is a line the excerpt starts from (or `before` lines above it); a
 * build fails if it is no longer in the file, so the excerpt cannot drift
 * away from the code without someone noticing.
 */
export const PEEKS: Array<{ file: string; find: string; before?: number; lines: number }> = [
  { file: "content/projects.ts", find: "export const PROJECTS", lines: 9 },
  { file: "scripts/deploy.sh", find: "npx tsx backend/prisma/seed.ts", before: 5, lines: 7 },
  { file: "backend/prisma/schema.prisma", find: "model Project {", lines: 12 },
  { file: "backend/src/routes/projects.ts", find: "projectsRouter.get(", lines: 11 },
  { file: "frontend/src/App.tsx", find: ".getProjects()", before: 5, lines: 12 },
];

export type TokenKind = "kw" | "str" | "com" | "num" | "fn" | "txt";

const KEYWORDS = new Set([
  "const", "let", "var", "export", "import", "from", "return", "async", "await", "function", "if", "else",
  "new", "type", "interface", "model", "true", "false", "null", "undefined", "set", "then", "catch",
]);

/**
 * One line split into highlighted pieces: comments (// and #), strings,
 * numbers, keywords, and names called as functions. Small on purpose: it
 * only has to make an excerpt read like code, not parse it.
 */
export function tokenize(line: string): Array<[TokenKind, string]> {
  const out: Array<[TokenKind, string]> = [];
  const push = (kind: TokenKind, text: string) => {
    const last = out[out.length - 1];
    if (last && last[0] === kind) last[1] += text;
    else out.push([kind, text]);
  };
  let i = 0;
  while (i < line.length) {
    const rest = line.slice(i);
    const comment = /^(\/\/.*|#(?!!).*)$/.exec(rest);
    if (comment && (rest.startsWith("//") || /^\s*$/.test(line.slice(0, i)) || line[i - 1] === " ")) {
      push("com", rest);
      break;
    }
    const str = /^("([^"\\]|\\.)*"|'([^'\\]|\\.)*'|`([^`\\]|\\.)*`)/.exec(rest);
    if (str) {
      push("str", str[0]);
      i += str[0].length;
      continue;
    }
    const num = /^\d+(\.\d+)?/.exec(rest);
    if (num && !/[\w$]/.test(line[i - 1] ?? "")) {
      push("num", num[0]);
      i += num[0].length;
      continue;
    }
    const word = /^[A-Za-z_$][\w$]*/.exec(rest);
    if (word) {
      const w = word[0];
      const called = line[i + w.length] === "(";
      push(KEYWORDS.has(w) ? "kw" : called ? "fn" : "txt", w);
      i += w.length;
      continue;
    }
    push("txt", line[i]);
    i += 1;
  }
  return out;
}

/** The excerpt for one peek: the first line's number and its tokenised lines, common indent removed. */
export function excerpt(source: string, peek: (typeof PEEKS)[number]) {
  const all = source.split(/\r?\n/);
  const at = all.findIndex((l) => l.includes(peek.find));
  if (at < 0) throw new Error(`code peek: "${peek.find}" is no longer in ${peek.file}`);
  const start = Math.max(0, at - (peek.before ?? 0));
  const lines = all.slice(start, start + peek.lines);
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => /^\s*/.exec(l)![0].length));
  return { file: peek.file, start: start + 1, lines: lines.map((l) => tokenize(l.slice(indent))) };
}

/** Commits per day, from the dates the committer wrote (their own calendar day). */
export function commitDays(): Array<[string, number]> {
  try {
    const out = execFileSync("git", ["log", "--format=%cI"], {
      cwd: REPO,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const days = new Map<string, number>();
    for (const iso of out.split("\n").filter(Boolean)) {
      const day = iso.slice(0, 10);
      days.set(day, (days.get(day) ?? 0) + 1);
    }
    return [...days.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  } catch {
    return [];
  }
}

function virtual(id: string, load: () => string, watch: string[] = []): Plugin {
  const resolved = "\0" + id;
  return {
    name: id,
    resolveId: (x) => (x === id ? resolved : undefined),
    load(x) {
      if (x !== resolved) return undefined;
      for (const f of watch) this.addWatchFile(f);
      return load();
    },
  };
}

export function repoFacts(): Plugin[] {
  return [
    virtual(
      "virtual:code-peeks",
      () => {
        const peeks = Object.fromEntries(
          PEEKS.map((p) => [p.file, excerpt(readFileSync(join(REPO, p.file), "utf8"), p)]),
        );
        return `export const PEEKS = ${JSON.stringify(peeks)};\n`;
      },
      PEEKS.map((p) => join(REPO, p.file)),
    ),
    virtual("virtual:commit-log", () => `export const COMMIT_DAYS = ${JSON.stringify(commitDays())};\n`),
  ];
}
