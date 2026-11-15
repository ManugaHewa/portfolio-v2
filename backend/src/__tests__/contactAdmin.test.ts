import { describe, it, expect, vi } from "vitest";
import {
  DEFAULT_RETENTION_DAYS,
  deleteMessagesFrom,
  formatMessage,
  listMessages,
  printable,
  pruneMessages,
  retentionCutoff,
  type ContactStore,
} from "../lib/contactAdmin.js";

function fakeStore(count = 3) {
  const store = {
    contactMessage: {
      count: vi.fn().mockResolvedValue(count),
      deleteMany: vi.fn().mockResolvedValue({ count }),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
  return store satisfies ContactStore;
}

describe("reading messages", () => {
  it("lists the newest first, as many as asked", async () => {
    const db = fakeStore();
    await listMessages(db, 5);
    expect(db.contactMessage.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { name: true, email: true, message: true, createdAt: true },
    });
  });

  it("prints sender and indented text", () => {
    const out = formatMessage({
      name: "Jane Recruiter",
      email: "jane@example.com",
      message: "Hello,\nlet's talk.",
      createdAt: new Date(2026, 10, 15, 9, 5),
    });
    expect(out).toBe("2026-11-15 09:05  Jane Recruiter <jane@example.com>\n    Hello,\n    let's talk.");
  });

  it("cannot drive the terminal: escape and bidi characters are replaced", () => {
    const hostile = "hi\u001b[2J\u001b]0;pwned\u0007 ‮evil";
    // eslint-disable-next-line no-control-regex -- checking control characters are gone
    expect(printable(hostile)).not.toMatch(/[\u001b\u0007‮]/);
    expect(printable("plain text, émigré")).toBe("plain text, émigré");
  });
});

describe("deletion requests", () => {
  it("deletes every message from the address, ignoring case and stray spaces", async () => {
    const db = fakeStore(2);

    expect(await deleteMessagesFrom(db, "  Jane@Example.com ")).toBe(2);
    expect(db.contactMessage.deleteMany).toHaveBeenCalledWith({
      where: { email: { equals: "Jane@Example.com", mode: "insensitive" } },
    });
  });

  it("only counts on a dry run", async () => {
    const db = fakeStore(5);

    expect(await deleteMessagesFrom(db, "jane@example.com", { dryRun: true })).toBe(5);
    expect(db.contactMessage.deleteMany).not.toHaveBeenCalled();
  });
});

describe("retention", () => {
  const now = new Date("2026-10-06T12:00:00Z");

  it("keeps twelve months by default, matching the privacy page", () => {
    expect(DEFAULT_RETENTION_DAYS).toBe(365);
  });

  it("deletes what is older than the cutoff and nothing newer", async () => {
    const db = fakeStore(4);

    expect(await pruneMessages(db, 365, { now })).toBe(4);
    expect(db.contactMessage.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: new Date("2025-10-06T12:00:00Z") } },
    });
  });

  it("only counts on a dry run", async () => {
    const db = fakeStore(1);

    await pruneMessages(db, 30, { dryRun: true, now });
    expect(db.contactMessage.count).toHaveBeenCalledWith({
      where: { createdAt: { lt: retentionCutoff(30, now) } },
    });
    expect(db.contactMessage.deleteMany).not.toHaveBeenCalled();
  });
});
