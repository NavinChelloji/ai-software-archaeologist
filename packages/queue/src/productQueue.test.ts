import type { Pool } from "pg";
import type PgBoss from "pg-boss";
import { describe, expect, it, vi } from "vitest";
import { publishJob, subscribeJob } from "./productQueue";

function fakePool(alreadyProcessed = false): Pool {
  return {
    query: vi.fn().mockImplementation(async () => {
      if (alreadyProcessed) {
        const err = new Error("duplicate") as Error & { code: string };
        err.code = "23505";
        throw err;
      }
      return { rows: [] };
    }),
  } as unknown as Pool;
}

const noopLogger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };

describe("publishJob", () => {
  it("validates the payload and sends the envelope on the named queue", async () => {
    const send = vi.fn().mockResolvedValue("job-123");
    const boss = { send } as unknown as PgBoss;

    const jobId = await publishJob(boss, {
      eventType: "repo.deleted",
      payload: { repoId: "123e4567-e89b-12d3-a456-426614174000", reason: "user_request" },
      correlationId: "123e4567-e89b-12d3-a456-426614174001",
      userId: "123e4567-e89b-12d3-a456-426614174002",
    });

    expect(jobId).toBe("job-123");
    expect(send).toHaveBeenCalledWith(
      "repo.deleted",
      expect.objectContaining({ eventType: "repo.deleted" })
    );
  });

  it("throws when pg-boss declines to enqueue", async () => {
    const boss = { send: vi.fn().mockResolvedValue(null) } as unknown as PgBoss;

    await expect(
      publishJob(boss, {
        eventType: "repo.deleted",
        payload: { repoId: "123e4567-e89b-12d3-a456-426614174000", reason: "user_request" },
        correlationId: "123e4567-e89b-12d3-a456-426614174001",
        userId: "123e4567-e89b-12d3-a456-426614174002",
      })
    ).rejects.toThrow();
  });
});

describe("subscribeJob", () => {
  it("calls the handler once for a new job and skips duplicates", async () => {
    let registeredHandler: ((jobs: { id: string; data: unknown }[]) => Promise<void>) | undefined;
    const boss = {
      work: vi.fn().mockImplementation(async (_name: string, handler: typeof registeredHandler) => {
        registeredHandler = handler;
      }),
    } as unknown as PgBoss;

    const handler = vi.fn().mockResolvedValue(undefined);

    await subscribeJob(boss, "repo.deleted", { consumer: "indexer.test", pool: fakePool(false), logger: noopLogger as never }, handler);

    await registeredHandler?.([
      {
        id: "job-1",
        data: {
          eventId: "123e4567-e89b-12d3-a456-426614174000",
          eventType: "repo.deleted",
          version: 1,
          occurredAt: new Date().toISOString(),
          correlationId: "123e4567-e89b-12d3-a456-426614174001",
          causationId: null,
          userId: "123e4567-e89b-12d3-a456-426614174002",
          repoId: null,
          snapshotId: null,
          retryCount: 0,
          payload: { repoId: "123e4567-e89b-12d3-a456-426614174000", reason: "user_request" },
        },
      },
    ]);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("skips the handler when the event was already processed", async () => {
    let registeredHandler: ((jobs: { id: string; data: unknown }[]) => Promise<void>) | undefined;
    const boss = {
      work: vi.fn().mockImplementation(async (_name: string, handler: typeof registeredHandler) => {
        registeredHandler = handler;
      }),
    } as unknown as PgBoss;

    const handler = vi.fn().mockResolvedValue(undefined);

    await subscribeJob(boss, "repo.deleted", { consumer: "indexer.test", pool: fakePool(true), logger: noopLogger as never }, handler);

    await registeredHandler?.([
      {
        id: "job-1",
        data: {
          eventId: "123e4567-e89b-12d3-a456-426614174000",
          eventType: "repo.deleted",
          version: 1,
          occurredAt: new Date().toISOString(),
          correlationId: "123e4567-e89b-12d3-a456-426614174001",
          causationId: null,
          userId: "123e4567-e89b-12d3-a456-426614174002",
          repoId: null,
          snapshotId: null,
          retryCount: 0,
          payload: { repoId: "123e4567-e89b-12d3-a456-426614174000", reason: "user_request" },
        },
      },
    ]);

    expect(handler).not.toHaveBeenCalled();
  });
});
