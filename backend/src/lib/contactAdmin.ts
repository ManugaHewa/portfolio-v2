import type { Prisma } from "@prisma/client";

export interface StoredMessage {
  name: string;
  email: string;
  message: string;
  createdAt: Date;
}

const STORED = { name: true, email: true, message: true, createdAt: true } as const;

/** The part of a Prisma client these functions touch, so tests can pass a fake. */
export interface ContactStore {
  contactMessage: {
    count(args: { where: Prisma.ContactMessageWhereInput }): Promise<number>;
    deleteMany(args: { where: Prisma.ContactMessageWhereInput }): Promise<{ count: number }>;
    findMany(args: { orderBy: { createdAt: "desc" }; take: number; select: typeof STORED }): Promise<StoredMessage[]>;
  };
}

/** The newest `limit` messages, newest first. */
export function listMessages(db: ContactStore, limit = 20): Promise<StoredMessage[]> {
  return db.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: limit, select: STORED });
}

/** Replaces control and bidi characters in visitor text, so a message cannot rewrite the terminal it is printed in. */
export function printable(text: string): string {
  // eslint-disable-next-line no-control-regex -- matching control characters is the point
  return text.replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩]/g, "�");
}

const pad = (n: number) => String(n).padStart(2, "0");

/** One message for the terminal: local date and sender, then the text indented. */
export function formatMessage({ name, email, message, createdAt: d }: StoredMessage): string {
  const when = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const body = printable(message)
    .split(/\r?\n/)
    .map((line) => `    ${line}`)
    .join("\n");
  return `${when}  ${printable(name)} <${printable(email)}>\n${body}`;
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
