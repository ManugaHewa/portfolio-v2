// Page views per day from the Nginx access logs, current and rotated (up to
// the 14 days Nginx keeps). Counted here on the server and printed; nothing is
// stored or sent anywhere.
//
//   npm run visits
//   npm run visits -- /path/to/access.log ...   (other log files)
import { createReadStream, readdirSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { formatSummary, parseLine, summarise, type Hit } from "../src/lib/visits.js";
import { describe } from "./describe.js";

const DIR = "/var/log/nginx";

async function* hits(files: string[]): AsyncGenerator<Hit> {
  for (const file of files) {
    const raw = createReadStream(file);
    const lines = createInterface({ input: file.endsWith(".gz") ? raw.pipe(createGunzip()) : raw, crlfDelay: Infinity });
    for await (const line of lines) {
      const hit = parseLine(line);
      if (hit) yield hit;
    }
  }
}

try {
  const files =
    process.argv.length > 2
      ? process.argv.slice(2)
      : readdirSync(DIR)
          .filter((f) => /^access\.log(\.\d+)?(\.gz)?$/.test(f))
          .map((f) => join(DIR, f));
  const all: Hit[] = [];
  for await (const hit of hits(files)) all.push(hit);
  console.log(formatSummary(summarise(all)));
} catch (err) {
  const denied = (err as { code?: string }).code === "EACCES";
  console.error(
    denied
      ? "Can't read the Nginx logs. Add yourself to the adm group once (sudo usermod -aG adm $USER), log out and back in, then run this again."
      : `visits failed: ${describe(err)}`,
  );
  process.exitCode = 1;
}
