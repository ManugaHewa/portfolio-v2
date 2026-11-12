// The modules frontend/build/repoFacts.ts generates from this repository at
// build time.
declare module "virtual:code-peeks" {
  export type TokenKind = "kw" | "str" | "com" | "num" | "fn" | "txt";
  export interface Peek {
    /** Repository-relative path. */
    file: string;
    /** The excerpt's first line number in that file. */
    start: number;
    /** Each line as highlighted pieces. */
    lines: Array<Array<[TokenKind, string]>>;
  }
  /** Keyed by file path: the excerpt behind each pipeline step. */
  export const PEEKS: Record<string, Peek>;
}

declare module "virtual:commit-log" {
  /** Commits per calendar day, oldest first: ["2026-09-13", 3]. */
  export const COMMIT_DAYS: ReadonlyArray<readonly [string, number]>;
}
