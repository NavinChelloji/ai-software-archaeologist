import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { markEventProcessed } from "./processedEvents";

function fakeClient(behavior: "insert" | "duplicate" | "connection-error") {
  return {
    query: vi.fn().mockImplementation(async () => {
      if (behavior === "duplicate") {
        const err = new Error("duplicate key value violates unique constraint") as Error & {
          code: string;
        };
        err.code = "23505";
        throw err;
      }
      if (behavior === "connection-error") {
        throw new Error("connection lost");
      }
      return { rows: [] };
    }),
  } as unknown as Pool;
}

describe("markEventProcessed", () => {
  it("returns true on first insert", async () => {
    await expect(markEventProcessed(fakeClient("insert"), "evt-1", "api.system.ping")).resolves.toBe(
      true
    );
  });

  it("returns false when the event was already processed by this consumer", async () => {
    await expect(
      markEventProcessed(fakeClient("duplicate"), "evt-1", "api.system.ping")
    ).resolves.toBe(false);
  });

  it("rethrows errors that are not a unique violation", async () => {
    await expect(
      markEventProcessed(fakeClient("connection-error"), "evt-1", "api.system.ping")
    ).rejects.toThrow("connection lost");
  });
});
