import { describe, expect, it } from "vitest";
import {
  AppError,
  buildEnvelope,
  ERROR_CODES,
  EnvelopeSchema,
  HTTP_STATUS_BY_CODE,
  JOB_NAMES,
  JobPayloadSchemas,
  parseEnvelope,
  JOB_STAGES,
  PROCESSING_STAGES,
  ProcessingJobDtoSchema,
  STAGE_PROGRESS_RANGES,
  statusForStage,
} from "./index";

describe("job contracts", () => {
  it("has exactly the 15 job names documented in EVENT_CONTRACTS.md", () => {
    expect(JOB_NAMES).toHaveLength(15);
  });

  it("has one payload schema per job name", () => {
    expect(Object.keys(JobPayloadSchemas).sort()).toEqual([...JOB_NAMES].sort());
  });

  it("builds and round-trips a valid envelope", () => {
    const envelope = buildEnvelope({
      eventType: "repo.deleted",
      payload: { repoId: "123e4567-e89b-12d3-a456-426614174000", reason: "user_request" },
      correlationId: "123e4567-e89b-12d3-a456-426614174001",
      userId: "123e4567-e89b-12d3-a456-426614174002",
    });

    expect(() => EnvelopeSchema.parse(envelope)).not.toThrow();
    const parsed = parseEnvelope("repo.deleted", envelope);
    expect(parsed.payload.reason).toBe("user_request");
  });

  it("rejects a payload that doesn't match its job's schema", () => {
    expect(() =>
      buildEnvelope({
        eventType: "repo.deleted",
        // @ts-expect-error deliberately wrong payload shape
        payload: { repoId: "not-a-uuid" },
        correlationId: "123e4567-e89b-12d3-a456-426614174001",
        userId: "123e4567-e89b-12d3-a456-426614174002",
      })
    ).toThrow();
  });
});

describe("error contracts", () => {
  it("has exactly the 53 codes documented in API_ERROR_CODES.md", () => {
    expect(ERROR_CODES).toHaveLength(53);
  });

  it("maps every code to an HTTP status", () => {
    for (const code of ERROR_CODES) {
      expect(HTTP_STATUS_BY_CODE[code]).toBeTypeOf("number");
    }
    expect(Object.keys(HTTP_STATUS_BY_CODE).sort()).toEqual([...ERROR_CODES].sort());
  });

  it("NO_CONTEXT_FOUND is a 200 — a successful answer, not a failure", () => {
    expect(HTTP_STATUS_BY_CODE.NO_CONTEXT_FOUND).toBe(200);
  });

  it("AppError produces a valid ErrorEnvelope", () => {
    const err = new AppError("REPO_NOT_FOUND", "This repository does not exist.");
    const envelope = err.toEnvelope("123e4567-e89b-12d3-a456-426614174000");
    expect(envelope.error.code).toBe("REPO_NOT_FOUND");
    expect(envelope.error.retryable).toBe(false);
    expect(err.status).toBe(404);
  });

  it("defaults retryable to true for dependency-style errors", () => {
    const err = new AppError("LLM_TIMEOUT", "The model took too long to respond.");
    expect(err.retryable).toBe(true);
  });
});

describe("pipeline contracts", () => {
  it("derives JOB_STAGES from the five processing stages plus queued/completed/failed/cancelled", () => {
    expect(PROCESSING_STAGES).toEqual(["snapshotting", "extracting", "parsing", "graphing", "embedding"]);
    expect(JOB_STAGES).toEqual([
      "queued",
      "snapshotting",
      "extracting",
      "parsing",
      "graphing",
      "embedding",
      "completed",
      "failed",
      "cancelled",
    ]);
  });

  it("has a progress range for every processing stage plus queued and completed", () => {
    for (const stage of [...PROCESSING_STAGES, "queued", "completed"] as const) {
      expect(STAGE_PROGRESS_RANGES[stage]).toBeDefined();
    }
    expect(STAGE_PROGRESS_RANGES.embedding).toEqual({ min: 75, max: 99 });
    expect(STAGE_PROGRESS_RANGES.completed).toEqual({ min: 100, max: 100 });
  });

  it("maps fine-grained stages to the coarse status a client branches on", () => {
    expect(statusForStage("queued")).toBe("queued");
    expect(statusForStage("parsing")).toBe("running");
    expect(statusForStage("completed")).toBe("completed");
    expect(statusForStage("failed")).toBe("failed");
    expect(statusForStage("cancelled")).toBe("cancelled");
  });

  it("validates a well-formed ProcessingJobDto", () => {
    const dto = {
      jobId: "123e4567-e89b-12d3-a456-426614174000",
      repoId: "123e4567-e89b-12d3-a456-426614174001",
      snapshotId: null,
      status: "running",
      stage: "parsing",
      progressPercent: 42,
      message: "Parsed 812 of 1,940 files",
      errorCode: null,
      errorMessage: null,
      retryCount: 0,
      startedAt: "2026-08-19T10:30:00.000Z",
      completedAt: null,
      createdAt: "2026-08-19T10:29:00.000Z",
      updatedAt: "2026-08-19T10:31:02.140Z",
    };
    expect(() => ProcessingJobDtoSchema.parse(dto)).not.toThrow();
  });
});
