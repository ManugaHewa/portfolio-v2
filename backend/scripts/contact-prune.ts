// Deletes contact messages older than the retention period, which the privacy
// page promises. Meant for a daily cron on the server (docs/manual-steps.md):
//
//   npm run contact:prune               (CONTACT_RETENTION_DAYS, default 365)
//   npm run contact:prune -- --dry-run  (count only)
//
// It prints a count and nothing about the messages themselves, so its log
// holds no personal data.
import { loadEnv } from "./env.js";

loadEnv();

const dryRun = process.argv.includes("--dry-run");
const { DEFAULT_RETENTION_DAYS, pruneMessages } = await import("../src/lib/contactAdmin.js");

const configured = Number(process.env.CONTACT_RETENTION_DAYS);
const days =
  Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_RETENTION_DAYS;

const { PrismaClient } = await import("@prisma/client");
// "minimal": the message without a code frame of this file, which is noise in a log.
const db = new PrismaClient({ errorFormat: "minimal" });
try {
  const count = await pruneMessages(db, days, { dryRun });
  const stamp = new Date().toISOString();
  console.log(
    dryRun
      ? `${stamp} ${count} message(s) are older than ${days} days and would be deleted.`
      : `${stamp} deleted ${count} message(s) older than ${days} days.`,
  );
} catch (err) {
  // One readable line, not Prisma's stack: this also lands in the cron log.
  console.error(`contact:prune failed: ${describe(err)}`);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}

function describe(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  return err.message
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("Invalid `"))
    .join(" ");
}
