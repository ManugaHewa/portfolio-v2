import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PrivacyPage } from "../components/PrivacyPage";
import { ContactForm } from "../components/ContactForm";
import { RETENTION, SITE } from "../site";

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

  it("credits every library that ships to the browser", () => {
    render(<PrivacyPage />);
    for (const name of ["React", "Three.js", "GSAP", "Framer Motion", "Lenis"]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
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
