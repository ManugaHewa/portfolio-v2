// Honours a deletion request: removes every contact message sent from one
// address. Run from the repo root, so it picks up the owner credentials:
//
//   npm run contact:delete -- someone@example.com --dry-run   (count only)
//   npm run contact:delete -- someone@example.com
import { loadEnv } from "./env.js";

loadEnv();

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const email = args.find((arg) => !arg.startsWith("--"));

if (!email || !/^[^\s@]+@[^\s@]+$/.test(email)) {
  console.error("Usage: npm run contact:delete -- someone@example.com [--dry-run]");
  process.exit(2);
}

// Imported after loadEnv, so the client is built with the right DATABASE_URL.
const { PrismaClient } = await import("@prisma/client");
const { deleteMessagesFrom } = await import("../src/lib/contactAdmin.js");

// "minimal": the message without a code frame of this file, which is noise in a log.
const db = new PrismaClient({ errorFormat: "minimal" });
try {
  const count = await deleteMessagesFrom(db, email, { dryRun });
  console.log(
    dryRun
      ? `${count} message(s) from ${email} would be deleted. Run again without --dry-run to delete them.`
      : `Deleted ${count} message(s) from ${email}.`,
  );
} catch (err) {
  // One readable line, not Prisma's stack: this also lands in the cron log.
  console.error(`contact:delete failed: ${describe(err)}`);
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
