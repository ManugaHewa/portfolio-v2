import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnv } from "../../scripts/env.js";

const KEYS = ["T_URL", "T_QUOTED", "T_SINGLE", "T_EXPORTED", "T_COMMENTED", "T_SET", "T_ROOT_WINS"];
let dir = "";

afterEach(() => {
  for (const key of KEYS) delete process.env[key];
  if (dir) rmSync(dir, { recursive: true, force: true });
});

function files(root: string, backend: string) {
  dir = mkdtempSync(join(tmpdir(), "env-test-"));
  writeFileSync(join(dir, "root.env"), root);
  writeFileSync(join(dir, "backend.env"), backend);
  return [join(dir, "root.env"), join(dir, "backend.env")];
}

describe("loadEnv, which the admin scripts and the seed rely on", () => {
  it("reads the formats the server's .env files use, CRLF included", () => {
    loadEnv(
      files(
        [
          "T_URL=postgresql://u:p@127.0.0.1:5432/portfolio?schema=public",
          'T_QUOTED="postgresql://owner:secret@127.0.0.1:5432/db"',
          "T_SINGLE='single quoted'",
          "export T_EXPORTED=yes",
          "T_COMMENTED=value # trailing comment",
          "# a whole-line comment",
        ].join("\r\n"),
        "",
      ),
    );

    expect(process.env.T_URL).toBe("postgresql://u:p@127.0.0.1:5432/portfolio?schema=public");
    expect(process.env.T_QUOTED).toBe("postgresql://owner:secret@127.0.0.1:5432/db");
    expect(process.env.T_SINGLE).toBe("single quoted");
    expect(process.env.T_EXPORTED).toBe("yes");
    expect(process.env.T_COMMENTED).toBe("value");
  });

  it("lets the repo-root file win, so admin scripts get the owner role", () => {
    loadEnv(files("T_ROOT_WINS=owner", "T_ROOT_WINS=insert-only"));
    expect(process.env.T_ROOT_WINS).toBe("owner");
  });

  it("never overrides a variable that is already set", () => {
    process.env.T_SET = "from-the-shell";
    loadEnv(files("T_SET=from-a-file", ""));
    expect(process.env.T_SET).toBe("from-the-shell");
  });
});
