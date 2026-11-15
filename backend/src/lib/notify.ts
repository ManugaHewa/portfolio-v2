/** What the alert says. Never the visitor's name, email or message: push topics can be read by anyone who guesses them. */
export const NEW_MESSAGE_TEXT = "New message from the portfolio contact form. Read it on the server: npm run contact:list";

const WEBHOOK = /hooks\.slack\.com|discord(app)?\.com\/api\/webhooks/;

/**
 * Pings `url` that a message arrived: an ntfy topic, or a Slack or Discord
 * webhook (the same targets deploy.sh supports). Never throws; a failed
 * ping is logged and the message is already stored.
 */
export async function pingNewMessage(url: string, send: typeof fetch = fetch): Promise<void> {
  const init: RequestInit = WEBHOOK.test(url)
    ? {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: NEW_MESSAGE_TEXT, text: NEW_MESSAGE_TEXT }),
      }
    : { headers: { Title: "Portfolio: new message", Tags: "envelope" }, body: NEW_MESSAGE_TEXT };
  try {
    const res = await send(url, { ...init, method: "POST", signal: AbortSignal.timeout(5000) });
    if (!res.ok) console.error(`New-message ping answered ${res.status}`);
  } catch (err) {
    console.error(`New-message ping failed: ${err instanceof Error ? err.name : "Error"}`);
  }
}
