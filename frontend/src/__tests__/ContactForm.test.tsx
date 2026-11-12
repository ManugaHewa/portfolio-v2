import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContactForm, countBucket } from "../components/ContactForm";
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

  it("says which status the server answered a failed send with", async () => {
    sendMock.mockRejectedValue(Object.assign(new Error("server"), { httpStatus: 429 }));
    render(<ContactForm />);
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/the server answered 429/i);
  });

  it("shows the status the server answered a delivered message with", async () => {
    sendMock.mockResolvedValue({ status: "received", httpStatus: 201 });
    render(<ContactForm />);
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));
    expect(await screen.findByText(/the server answered 201 Created/i, {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it("counts characters against the limit the API enforces", () => {
    render(<ContactForm />);
    fill(/^message$/i, "hello");
    expect(screen.getByText("5 / 2000")).toBeInTheDocument();
  });
  it("announces the count only when it crosses 200 left, 50 left and over", () => {
    const { container } = render(<ContactForm />);
    const note = () =>
      [...container.querySelectorAll('[role="status"]')].map((n) => n.textContent).join("");

    fill(/^message$/i, "a".repeat(1500));
    expect(note()).toBe("");
    fill(/^message$/i, "a".repeat(1800));
    expect(note()).toBe("200 characters left");
    // Typing on inside the same bucket stays quiet.
    fill(/^message$/i, "a".repeat(1810));
    expect(note()).toBe("200 characters left");
    fill(/^message$/i, "a".repeat(1960));
    expect(note()).toBe("40 characters left");
    fill(/^message$/i, "a".repeat(2003));
    expect(note()).toBe("3 characters over the limit");
    // Deleting back under the limit is not narrated.
    fill(/^message$/i, "a".repeat(1500));
    expect(note()).toBe("");
  });

  it("buckets the remaining count", () => {
    expect(countBucket(500)).toBeNull();
    expect(countBucket(200)).toBe(200);
    expect(countBucket(51)).toBe(200);
    expect(countBucket(50)).toBe(50);
    expect(countBucket(0)).toBe(50);
    expect(countBucket(-1)).toBe("over");
  });

  it("says Sending, ignores a second press and shows the trace while the request is out", async () => {
    let resolve: (v: { status: string }) => void = () => {};
    sendMock.mockImplementation(() => new Promise((r) => (resolve = r)) as never);
    render(<ContactForm />);
    fillValid();
    const button = screen.getByRole("button", { name: /send message/i });
    fireEvent.click(button);

    const busy = await screen.findByRole("button", { name: /^sending$/i });
    expect(busy).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByLabelText(/^name$/i)).toBeDisabled();
    expect(screen.getByText(/Sending: step/)).toBeInTheDocument();

    fireEvent.click(busy);
    expect(sendMock).toHaveBeenCalledTimes(1);

    resolve({ status: "received" });
    expect(await screen.findByText(/message received/i)).toBeInTheDocument();
  });

  it("never steps the trace back when the answer beats the next frame", async () => {
    // Hold every frame, so the server's answer lands before the frame that
    // was meant to move the trace from validate to the network hop.
    const frames: FrameRequestCallback[] = [];
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    try {
      sendMock.mockResolvedValue({ status: "received" });
      render(<ContactForm />);
      fillValid();
      fireEvent.click(screen.getByRole("button", { name: /send message/i }));

      // Answered: the trace is on zod.parse, step 3 of 4.
      expect(await screen.findByText(/Sending: step 3 of 4/)).toBeInTheDocument();
      act(() => frames.splice(0).forEach((cb) => cb(performance.now())));
      expect(screen.queryByText(/Sending: step 2 of 4/)).toBeNull();
      expect(await screen.findByText(/message received/i)).toBeInTheDocument();
    } finally {
      raf.mockRestore();
    }
  });
});
