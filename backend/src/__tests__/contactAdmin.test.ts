import { describe, it, expect, vi } from "vitest";
import {
  DEFAULT_RETENTION_DAYS,
  deleteMessagesFrom,
  pruneMessages,
  retentionCutoff,
  type ContactStore,
} from "../lib/contactAdmin.js";

function fakeStore(count = 3) {
  const store = {
    contactMessage: {
      count: vi.fn().mockResolvedValue(count),
      deleteMany: vi.fn().mockResolvedValue({ count }),
    },
  };
  return store satisfies ContactStore;
}

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
