import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncRoute } from "../lib/asyncRoute.js";
import { verifyTurnstile } from "../lib/turnstile.js";

export interface ContactOptions {
  /** Submissions faster than this, from the form appearing, are treated as bots. */
  minSubmitMs: number;
  /** Cloudflare Turnstile secret; null switches the check off. */
  turnstileSecret: string | null;
}

/**
 * Strict, so a field the form does not send is a 400 rather than something
 * Zod quietly drops. Nothing outside this list can reach the insert below.
 */
const contactSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().max(254).email(),
    message: z.string().trim().min(10).max(2000),
    // A honeypot: the form renders it off screen, out of the tab order and
    // hidden from assistive tech, so a person leaves it empty and a form-
    // filling bot usually does not.
    website: z.string().max(200).optional(),
    // How long the form was on screen before it was sent. A person needs more
    // than a few seconds to write ten characters; a script posting the moment
    // the page loads does not.
    elapsedMs: z.number().int().nonnegative(),
    // Only checked when Turnstile is switched on, but always allowed, so the
    // frontend and API can be switched on in either order.
    turnstileToken: z.string().max(2048).optional(),
  })
  .strict();

/** The same answer for a stored message and a dropped bot, so a bot learns nothing. */
const RECEIVED = { status: "received" } as const;

// POST /api/contact: validates and stores the message.
//
// Nothing here forwards visitor text anywhere. If a notification is ever
// added, it must not carry the name, email or message through a public push
// service such as the ntfy topic the deploy script uses: those topics are
// readable by anyone who guesses the name.
//
// Any route that reads these messages back must authenticate on the server.
// There is no such route today, by design.
export function createContactRouter({ minSubmitMs, turnstileSecret }: ContactOptions) {
  const router = Router();

  router.post(
    "/",
    asyncRoute(async (req, res) => {
      const parsed = contactSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }

      const { name, email, message, website, elapsedMs, turnstileToken } = parsed.data;

      if ((website ?? "").trim() !== "" || elapsedMs < minSubmitMs) {
        return res.status(201).json(RECEIVED);
      }

      if (turnstileSecret && !(await verifyTurnstile(turnstileSecret, turnstileToken, req.ip))) {
        return res.status(403).json({ error: "Verification failed" });
      }

      // createMany rather than create: it inserts without RETURNING, so the
      // database role the service runs as needs INSERT on this table and
      // nothing else. Even a compromised API process cannot read back what
      // visitors have sent. See docs/manual-steps.md for the role itself.
      await prisma.contactMessage.createMany({ data: [{ name, email, message }] });
      res.status(201).json(RECEIVED);
    }),
  );

  return router;
}
