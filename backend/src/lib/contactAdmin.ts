import type { Prisma } from "@prisma/client";

/** The part of a Prisma client these functions touch, so tests can pass a fake. */
export interface ContactStore {
  contactMessage: {
    count(args: { where: Prisma.ContactMessageWhereInput }): Promise<number>;
    deleteMany(args: { where: Prisma.ContactMessageWhereInput }): Promise<{ count: number }>;
  };
}

/**
 * How long a message is kept. The privacy page and the line under the form
 * both say twelve months (RETENTION in frontend/src/site.ts), so change them
 * together.
 */
export const DEFAULT_RETENTION_DAYS = 365;

const DAY_MS = 24 * 60 * 60 * 1000;

export function retentionCutoff(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

/**
 * Deletes every message sent from one address: the privacy page's promise for
 * a deletion request. Case-insensitive, because people do not type their own
 * address the same way twice.
 */
export async function deleteMessagesFrom(
  db: ContactStore,
  email: string,
  { dryRun = false } = {},
): Promise<number> {
  const where: Prisma.ContactMessageWhereInput = {
    email: { equals: email.trim(), mode: "insensitive" },
  };
  if (dryRun) return db.contactMessage.count({ where });
  const { count } = await db.contactMessage.deleteMany({ where });
  return count;
}

/** Deletes every message older than the retention period. */
export async function pruneMessages(
  db: ContactStore,
  days: number = DEFAULT_RETENTION_DAYS,
  { dryRun = false, now = new Date() }: { dryRun?: boolean; now?: Date } = {},
): Promise<number> {
  const where: Prisma.ContactMessageWhereInput = {
    createdAt: { lt: retentionCutoff(days, now) },
  };
  if (dryRun) return db.contactMessage.count({ where });
  const { count } = await db.contactMessage.deleteMany({ where });
  return count;
}
