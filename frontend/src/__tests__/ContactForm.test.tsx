import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContactForm } from "../components/ContactForm";
import { api } from "../api";

vi.mock("../api", () => ({
  api: { sendContactMessage: vi.fn() },
}));

const sendMock = vi.mocked(api.sendContactMessage);

const fill = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const fillValid = () => {
  fill(/^name$/i, "Ada Lovelace");
  fill(/^email$/i, "ada@example.com");
  fill(/^message$/i, "I would like to talk to you about a full-stack role.");
};

describe("ContactForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks submission and explains why when fields are invalid", async () => {
    render(<ContactForm />);
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    expect(await screen.findByText(/tell me who you are/i)).toBeInTheDocument();
    expect(screen.getByText(/address to reply to/i)).toBeInTheDocument();
    expect(screen.getByText(/at least 10 characters/i)).toBeInTheDocument();
    // The invalid submit must not cost a round trip to the API.
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed email the way the Zod schema would", () => {
    render(<ContactForm />);
    fill(/^email$/i, "not-an-email");
    fireEvent.blur(screen.getByLabelText(/^email$/i));

    expect(screen.getByText(/does not look like a valid email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toHaveAttribute("aria-invalid", "true");
  });

  it("shows the success state after a successful send", async () => {
    // Regression guard: the old version read e.currentTarget after awaiting,
    // which React has already nulled. That threw inside the try block and
    // flipped a genuinely successful send to the error state.
    sendMock.mockResolvedValue({ status: "received" });
    render(<ContactForm />);
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    expect(await screen.findByText(/message received/i)).toBeInTheDocument();
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Ada Lovelace",
        email: "ada@example.com",
        message: "I would like to talk to you about a full-stack role.",
      }),
    );
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });

  it("sends the empty honeypot and how long the form was open", async () => {
    // The API refuses a send without the timing field and silently drops one
    // that arrives too fast or with the honeypot filled, so both always travel.
    sendMock.mockResolvedValue({ status: "received" });
    render(<ContactForm />);
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    await screen.findByText(/message received/i);
    const payload = sendMock.mock.calls[0][0];
    expect(payload.website).toBe("");
    expect(typeof payload.elapsedMs).toBe("number");
    expect(payload.elapsedMs).toBeGreaterThanOrEqual(0);
    // Off by default: no token field at all.
    expect(payload).not.toHaveProperty("turnstileToken");
  });

  it("keeps the honeypot away from keyboard and screen-reader users", () => {
    const { container } = render(<ContactForm />);
    const trap = container.querySelector<HTMLInputElement>('input[name="website"]');

    expect(trap).not.toBeNull();
    expect(trap).toHaveAttribute("tabindex", "-1");
    expect(trap?.closest('[aria-hidden="true"]')).not.toBeNull();
    // And it is not one of the labelled fields a person fills in.
    expect(screen.queryByRole("textbox", { name: /leave this field empty/i })).not.toBeInTheDocument();
  });

  it("lets the sender write another message after success", async () => {
    sendMock.mockResolvedValue({ status: "received" });
    render(<ContactForm />);
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    fireEvent.click(await screen.findByRole("button", { name: /send another message/i }));

    // Fields come back empty rather than holding the message already sent.
    expect(await screen.findByLabelText(/^name$/i)).toHaveValue("");
    expect(screen.getByLabelText(/^message$/i)).toHaveValue("");
  });

  it("surfaces a failure without losing what was typed", async () => {
    sendMock.mockRejectedValue(new Error("network"));
    render(<ContactForm />);
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/something went wrong/i);
    await waitFor(() => expect(screen.getByLabelText(/^name$/i)).toHaveValue("Ada Lovelace"));
  });

  it("counts characters against the limit the API enforces", () => {
    render(<ContactForm />);
    fill(/^message$/i, "hello");
    expect(screen.getByText("5 / 2000")).toBeInTheDocument();
  });
});
