import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrivacyPage } from "../components/PrivacyPage";
import { NotFoundPage } from "../components/NotFoundPage";
import { ContactForm } from "../components/ContactForm";
import { RETENTION, SITE } from "../site";

// From the import.meta.url string, never through `new URL()`: under jsdom the
// global URL is jsdom's, and Node's fileURLToPath rejects its objects.
const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path: string) => readFileSync(join(SRC, path), "utf8");

vi.mock("../api", () => ({ api: { sendContactMessage: vi.fn() } }));

describe("the privacy page", () => {
  it("is one page with one h1 and a heading for each question", () => {
    render(<PrivacyPage />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    for (const heading of [
      /what the contact form collects/i,
      /where it is kept/i,
      /deleting your message/i,
      /who else handles the traffic/i,
      /cookies and tracking/i,
      /server logs/i,
      /terms/i,
      /credits/i,
    ]) {
      expect(screen.getByRole("heading", { level: 2, name: heading })).toBeInTheDocument();
    }
  });

  it("states the same retention period the form and the prune script use", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(new RegExp(`deleted automatically ${RETENTION.label}`))).toBeInTheDocument();
  });

  it("names exactly what is stored, and what is not", () => {
    render(<PrivacyPage />);
    // Mirrors the ContactMessage model: name, email, message, createdAt.
    expect(screen.getByText(/your name, your email address, your message, and the time/i)).toBeInTheDocument();
    expect(screen.getByText(/not your ip address/i)).toBeInTheDocument();
  });

  it("says how to ask for deletion, with a working address", () => {
    render(<PrivacyPage />);
    const link = screen.getByRole("link", { name: SITE.email });
    expect(link).toHaveAttribute("href", `mailto:${SITE.email}`);
  });

  it("credits every library and typeface that ships to the browser, and nothing that left", () => {
    render(<PrivacyPage />);
    for (const name of ["React", "Three.js", "Motion", "Mona Sans", "Martian Mono"]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
    expect(screen.getAllByText(/SIL Open Font License 1\.1/)).toHaveLength(2);
    // Both left with the redesign.
    for (const name of [/gsap/i, /lenis/i]) {
      expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
    }
  });

  it("says the fonts are served from this site, not that none are downloaded", () => {
    render(<PrivacyPage />);
    expect(screen.queryByText(/no fonts are downloaded/i)).not.toBeInTheDocument();
    expect(screen.getByText(/served from this site rather than a font service/i)).toBeInTheDocument();
  });

  it("carries the date of its last change", () => {
    render(<PrivacyPage />);
    expect(screen.getByText("Last updated 10 November 2026")).toBeInTheDocument();
  });

  it("has the plain header: the name, and a way back, with no section nav or pause toggle", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("link", { name: SITE.name })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Back to the portfolio" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("navigation", { name: "Primary" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pause motion/i })).not.toBeInTheDocument();
  });

  it("links the footer's credits to the credits section on this page", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("link", { name: "Credits" })).toHaveAttribute("href", "/privacy#credits");
    expect(document.getElementById("credits")).not.toBeNull();
    // "Back to top" needs a #top to land on here too.
    expect(screen.getByRole("link", { name: "Back to top" })).toHaveAttribute("href", "#top");
    expect(document.getElementById("top")).not.toBeNull();
  });
});

describe("the privacy page's entry", () => {
  it("loads only the shared styles and no animation code", () => {
    const entry = source("privacy-main.tsx");
    expect(entry).not.toMatch(/styles\/index\.css/);
    expect(entry).not.toMatch(/from\s+"(framer-motion|\.\/motion[^"]*)"/);
    for (const sheet of ["fonts", "tokens", "base", "chrome", "legal"]) {
      expect(entry).toContain(`./styles/${sheet}.css`);
    }
  });

  it("renders components that import no animation code either", () => {
    for (const file of ["components/PrivacyPage.tsx", "components/Footer.tsx", "components/NotFoundPage.tsx"]) {
      expect(source(file)).not.toMatch(/from\s+"(framer-motion|\.\.\/motion[^"]*)"/);
    }
  });
});

describe("the 404 page", () => {
  it("has one h1 and routes back to the portfolio", () => {
    render(<NotFoundPage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Go to the portfolio" })).toHaveAttribute("href", "/");
  });
});

describe("the contact form's privacy line", () => {
  it("says what happens to a message and links to the details", () => {
    render(<ContactForm />);
    expect(screen.getByText(/only to reply to you/i)).toHaveTextContent(RETENTION.label);
    expect(screen.getByRole("link", { name: /how your message is handled/i })).toHaveAttribute(
      "href",
      "/privacy",
    );
    // Nothing to tick: there is nothing optional to consent to.
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
