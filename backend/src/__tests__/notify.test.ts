import { describe, it, expect, vi } from "vitest";
import { NEW_MESSAGE_TEXT, pingNewMessage } from "../lib/notify.js";

const ok = () => vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

describe("new-message ping", () => {
  it("posts plain text with a title to an ntfy topic", async () => {
    const send = ok();
    await pingNewMessage("https://ntfy.sh/my-topic", send);
    const [url, init] = send.mock.calls[0];
    expect(url).toBe("https://ntfy.sh/my-topic");
    expect(init).toMatchObject({ method: "POST", body: NEW_MESSAGE_TEXT, headers: { Title: "Portfolio: new message" } });
  });

  it("posts JSON to a Discord or Slack webhook", async () => {
    const send = ok();
    await pingNewMessage("https://discord.com/api/webhooks/1/abc", send);
    const init = send.mock.calls[0][1];
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body)).toEqual({ content: NEW_MESSAGE_TEXT, text: NEW_MESSAGE_TEXT });
  });

  it("never throws, and logs only the error's name", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(pingNewMessage("https://ntfy.sh/t", vi.fn().mockRejectedValue(new Error("secret detail")))).resolves.toBeUndefined();
    expect(errors).toHaveBeenCalledWith("New-message ping failed: Error");
    errors.mockRestore();
  });
});
