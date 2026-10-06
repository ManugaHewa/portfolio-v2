import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Loads KEY=value lines into process.env without overriding anything already
 * set, from the repo-root .env first and then backend/.env.
 *
 * Explicit, because leaving it to Prisma's own discovery made the seed depend
 * on the working directory: it found DATABASE_URL from the repo root and not
 * from backend/. The order matters on the server. The repo-root .env holds the
 * owner role these scripts need; backend/.env holds the service's insert-only
 * role, which can neither read nor delete messages. Locally there is usually
 * only backend/.env, and that works too.
 */
export function loadEnv(
  files: string[] = [resolve(REPO_ROOT, ".env"), resolve(REPO_ROOT, "backend/.env")],
): string[] {
  const loaded: string[] = [];
  for (const file of files) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match || process.env[match[1]] !== undefined) continue;
      let value = match[2];
      const quoted = /^(["']).*\1$/.test(value);
      value = quoted ? value.slice(1, -1) : value.replace(/\s+#.*$/, "");
      process.env[match[1]] = value;
    }
    loaded.push(file);
  }
  return loaded;
}
