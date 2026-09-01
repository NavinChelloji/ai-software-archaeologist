import type { Pool } from "pg";
import type PgBoss from "pg-boss";
import { describe, expect, it, vi } from "vitest";
import { ensureProductQueue, listAllQueueNames, publishJob, retryBackoffSeconds, subscribeJob } from "./productQueue";

const REPO_ID = "123e4567-e89b-12d3-a456-426614174003";
const USER_ID = "123e4567-e89b-12d3-a456-426614174002";
const CORRELATION_ID = "123e4567-e89b-12d3-a456-426614174001";

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

    await publishJob(boss, {
      eventType: "chat.answer.completed",
      payload: {
        conversationId: "123e4567-e89b-12d3-a456-426614174005",
        messageId: "123e4567-e89b-12d3-a456-426614174006",
        snapshotId: "123e4567-e89b-12d3-a456-426614174004",
        model: "test-model",
        promptTokens: 10,
        completionTokens: 5,
        citationCount: 1,
        latencyMs: 100,
      },
      correlationId: CORRELATION_ID,
      userId: USER_ID,
      repoId: REPO_ID,
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      "chat.answer.completed",
      expect.objectContaining({ eventType: "chat.answer.completed" }),
      {}
    );
  });

  it("passes startAfter through to pg-boss when a backoff delay is given", async () => {
    const send = vi.fn().mockResolvedValue("job-123");
    const boss = { send } as unknown as PgBoss;

    await publishJob(
      boss,
      {
        eventType: "repo.deleted",
        payload: { repoId: "123e4567-e89b-12d3-a456-426614174000", reason: "user_request" },
        correlationId: CORRELATION_ID,
        userId: USER_ID,
      },
      60
    );

    expect(send).toHaveBeenCalledWith("repo.deleted", expect.anything(), { startAfter: 60 });
  });

  it("throws when pg-boss declines to enqueue", async () => {
    const boss = { send: vi.fn().mockResolvedValue(null) } as unknown as PgBoss;

    await expect(
      publishJob(boss, {
        eventType: "repo.deleted",
        payload: { repoId: "123e4567-e89b-12d3-a456-426614174000", reason: "user_request" },
        correlationId: CORRELATION_ID,
        userId: USER_ID,
      })
    ).rejects.toThrow();
  });

  it("fans out a registered job to every consumer queue, not just the job's own name", async () => {
    const send = vi.fn().mockResolvedValue("job-123");
    const boss = { send } as unknown as PgBoss;

    await publishJob(boss, {
      eventType: "repo.import.requested",
      payload: {
        provider: "github",
        providerRepoId: "1",
        fullName: "owner/repo",
        defaultBranch: "main",
        isPrivate: false,
        ref: null,
        reindex: false,
      },
      correlationId: CORRELATION_ID,
      userId: USER_ID,
      repoId: REPO_ID,
    });

    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith("repo.import.requested", expect.anything(), {});
    expect(send).toHaveBeenCalledWith("repo.import.requested.snapshots", expect.anything(), {});
  });

  it("fans out repo.deleted to both indexer's and ai's queues", async () => {
    const send = vi.fn().mockResolvedValue("job-123");
    const boss = { send } as unknown as PgBoss;

    await publishJob(boss, {
      eventType: "repo.deleted",
      payload: { repoId: "123e4567-e89b-12d3-a456-426614174000", reason: "user_request" },
      correlationId: CORRELATION_ID,
      userId: USER_ID,
    });

    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith("repo.deleted", expect.anything(), {});
    expect(send).toHaveBeenCalledWith("repo.deleted.ai", expect.anything(), {});
  });

  it("throws if any fan-out queue declines, even when the primary queue accepted", async () => {
    const send = vi.fn().mockImplementation(async (name: string) => (name === "repo.snapshot.created" ? "job-1" : null));
    const boss = { send } as unknown as PgBoss;

    await expect(
      publishJob(boss, {
        eventType: "repo.snapshot.created",
        payload: {
          commitSha: "abc123",
          ref: "main",
          archiveKey: "repo/snap/archive.tar.gz",
          sizeBytes: 100,
          reused: false,
          stage: "snapshotting",
          batchIndex: 0,
          batchCount: 1,
          itemsProcessed: 1,
          totalItems: 1,
          durationMs: 10,
        },
        correlationId: CORRELATION_ID,
        userId: USER_ID,
        repoId: REPO_ID,
        snapshotId: "123e4567-e89b-12d3-a456-426614174004",
      })
    ).rejects.toThrow();
  });
});

describe("ensureProductQueue", () => {
  const retryPolicy = { retryLimit: 3, retryBackoffSeconds: 30 };

  it("creates the queue and its dead-letter queue named after the job by default", async () => {
    const createQueue = vi.fn().mockResolvedValue(undefined);
    const boss = { createQueue } as unknown as PgBoss;

    await ensureProductQueue(boss, "repo.deleted", retryPolicy);

    expect(createQueue).toHaveBeenCalledWith("repo.deleted.dlq");
    expect(createQueue).toHaveBeenCalledWith("repo.deleted", expect.objectContaining({ name: "repo.deleted", deadLetter: "repo.deleted.dlq" }));
  });

  it("creates a distinctly named queue for a fan-out consumer, not one named after the job", async () => {
    const createQueue = vi.fn().mockResolvedValue(undefined);
    const boss = { createQueue } as unknown as PgBoss;

    await ensureProductQueue(boss, "repo.import.requested", retryPolicy, "repo.import.requested.snapshots");

    expect(createQueue).toHaveBeenCalledWith("repo.import.requested.snapshots.dlq");
    expect(createQueue).toHaveBeenCalledWith(
      "repo.import.requested.snapshots",
      expect.objectContaining({ name: "repo.import.requested.snapshots", deadLetter: "repo.import.requested.snapshots.dlq" })
    );
    expect(createQueue).not.toHaveBeenCalledWith("repo.import.requested", expect.anything());
  });
});

describe("listAllQueueNames", () => {
  it("includes every job's own queue plus every fan-out consumer queue, with no duplicates", () => {
    const names = listAllQueueNames();

    expect(names).toEqual([...new Set(names)]);
    expect(names).toContain("repo.deleted");
    expect(names).toContain("repo.deleted.ai");
    expect(names).toContain("user.deleted.ai");
    expect(names).toContain("snapshot.prune.ai");
    expect(names).toContain("repo.import.requested.snapshots");
  });
});

describe("retryBackoffSeconds", () => {
  it("doubles the base delay for each retry attempt", () => {
    expect(retryBackoffSeconds(1, 30)).toBe(30);
    expect(retryBackoffSeconds(2, 30)).toBe(60);
    expect(retryBackoffSeconds(3, 30)).toBe(120);
  });

  it("floors at the base delay for a non-positive retry count", () => {
    expect(retryBackoffSeconds(0, 30)).toBe(30);
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

  it("works its own fan-out queue name while still validating against the job name's schema", async () => {
    const work = vi.fn().mockResolvedValue(undefined);
    const boss = { work } as unknown as PgBoss;
    const handler = vi.fn().mockResolvedValue(undefined);

    await subscribeJob(
      boss,
      "repo.snapshot.created",
      { consumer: "indexer.parser.snapshot_created", pool: fakePool(false), logger: noopLogger as never },
      handler,
      "repo.snapshot.created.parser"
    );

    expect(work).toHaveBeenCalledWith("repo.snapshot.created.parser", expect.any(Function));
  });
});
