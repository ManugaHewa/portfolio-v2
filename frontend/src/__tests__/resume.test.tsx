import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resumeStamp } from "../../build/resume";

describe("résumé link", () => {
  it("is off until the PDF exists, then carries its size", () => {
    const dir = mkdtempSync(join(tmpdir(), "resume-"));
    const file = join(dir, "resume.pdf");
    expect(resumeStamp(file)).toBeNull();
    writeFileSync(file, Buffer.alloc(120 * 1024));
    expect(existsSync(file)).toBe(true);
    expect(resumeStamp(file)).toEqual({ href: "/resume.pdf", size: "120 kB" });
  });

  it("appears in the footer when there is one", async () => {
    vi.resetModules();
    vi.doMock("../site", async (load) => ({
      ...(await load<typeof import("../site")>()),
      RESUME: { href: "/resume.pdf", size: "120 kB" },
    }));
    const { Footer } = await import("../components/Footer");
    render(<Footer />);
    expect(screen.getByRole("link", { name: "Résumé (PDF, 120 kB)" })).toHaveAttribute("href", "/resume.pdf");
    vi.doUnmock("../site");
  });

  it("is absent without one", async () => {
    vi.resetModules();
    const { Footer } = await import("../components/Footer");
    render(<Footer />);
    expect(screen.queryByRole("link", { name: /résumé/i })).toBeNull();
  });
});
