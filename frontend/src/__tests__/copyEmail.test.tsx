import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { CopyEmail } from "../components/CopyEmail";

const EMAIL = "someone@example.com";

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, "clipboard", { value, configurable: true, writable: true });
}

describe("CopyEmail", () => {
  afterEach(() => {
    setClipboard(undefined);
    vi.useRealTimers();
    window.getSelection()?.removeAllRanges();
  });

  it("shows the address as a mailto link", () => {
    render(<CopyEmail email={EMAIL} />);
    expect(screen.getByRole("link", { name: EMAIL })).toHaveAttribute("href", `mailto:${EMAIL}`);
  });

  it("names the button by its visible word, then what it copies", () => {
    render(<CopyEmail email={EMAIL} />);
    expect(screen.getByRole("button", { name: "Copy email address" })).toBeInTheDocument();
  });

  it("keeps an empty polite live region in the page before anything happens", () => {
    // A region added at the moment it changes is often missed, so it has to
    // be there from the first render.
    render(<CopyEmail email={EMAIL} />);
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toBeEmptyDOMElement();
  });

  it("copies the address, confirms in place and announces it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    render(<CopyEmail email={EMAIL} />);

    fireEvent.click(screen.getByRole("button", { name: /copy email address/i }));

    expect(writeText).toHaveBeenCalledWith(EMAIL);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Email address copied"));
    expect(screen.getByRole("button", { name: /copied email address/i })).toBeInTheDocument();
  });

  it("goes back to Copy after a moment, and clears the announcement", async () => {
    vi.useFakeTimers();
    setClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
    render(<CopyEmail email={EMAIL} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });
    expect(screen.getByRole("status")).toHaveTextContent("Email address copied");

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByRole("button", { name: "Copy email address" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("selects the address when there is no clipboard API", async () => {
    setClipboard(undefined);
    render(<CopyEmail email={EMAIL} />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(window.getSelection()?.toString()).toBe(EMAIL));
    expect(screen.getByRole("status")).toHaveTextContent(/selected/i);
  });

  it("selects the address when the clipboard refuses", async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error("denied")) });
    render(<CopyEmail email={EMAIL} />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(window.getSelection()?.toString()).toBe(EMAIL));
    expect(screen.getByRole("status")).not.toHaveTextContent(/copied/i);
  });
});
