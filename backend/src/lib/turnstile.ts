const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Asks Cloudflare whether a Turnstile token is genuine.
 *
 * Fails closed: no token, a slow or unreachable Cloudflare, or an answer that
 * is not an explicit `success: true` all count as a failed check. For a contact
 * form that is the right side to err on, because the page offers a direct email
 * address for anyone the check turns away.
 */
export async function verifyTurnstile(
  secret: string,
  token: string | undefined,
  remoteIp: string | undefined,
): Promise<boolean> {
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const res = await fetch(SITEVERIFY, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: unknown };
    return data.success === true;
  } catch {
    return false;
  }
}
