import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncRoute } from "../lib/asyncRoute.js";

export const contactRouter = Router();

const contactSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  message: z.string().min(10).max(2000),
});

// POST /api/contact: persists the message and (in a real deploy)
// would also trigger an email/Slack notification via a mail provider.
contactRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const parsed = contactSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const saved = await prisma.contactMessage.create({ data: parsed.data });
    res.status(201).json({ id: saved.id, status: "received" });
  }),
);
