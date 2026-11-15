// Shows the newest contact messages in the terminal. Run on the server from
// the repo root, so it picks up the owner credentials:
//
//   npm run contact:list          (20 newest)
//   npm run contact:list -- 50    (50 newest)
import { loadEnv } from "./env.js";
import { describe } from "./describe.js";

loadEnv();

const limit = Number(process.argv[2] ?? 20);
if (!Number.isInteger(limit) || limit < 1) {
  console.error("Usage: npm run contact:list [-- COUNT]");
  process.exit(2);
}

// Imported after loadEnv, so the client is built with the right DATABASE_URL.
const { PrismaClient } = await import("@prisma/client");
const { formatMessage, listMessages } = await import("../src/lib/contactAdmin.js");

const db = new PrismaClient({ errorFormat: "minimal" });
try {
  const [total, messages] = await Promise.all([db.contactMessage.count({ where: {} }), listMessages(db, limit)]);
  if (messages.length === 0) console.log("No messages.");
  else console.log(`${messages.length} newest of ${total}:\n\n${messages.map(formatMessage).join("\n\n")}`);
} catch (err) {
  console.error(`contact:list failed: ${describe(err)}`);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
