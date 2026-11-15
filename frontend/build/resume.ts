import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// From the module path, not `new URL()`, which jsdom cannot resolve against file: URLs.
const RESUME_FILE = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "resume.pdf");

/** The résumé link, shown only once frontend/public/resume.pdf exists; size for the link text. */
export function resumeStamp(file = RESUME_FILE): { href: string; size: string } | null {
  if (!existsSync(file)) return null;
  return { href: "/resume.pdf", size: `${Math.max(1, Math.round(statSync(file).size / 1024))} kB` };
}
