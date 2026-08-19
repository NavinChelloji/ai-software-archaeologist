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
  it("has exactly the 46 codes documented in API_ERROR_CODES.md", () => {
    expect(ERROR_CODES).toHaveLength(46);
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
