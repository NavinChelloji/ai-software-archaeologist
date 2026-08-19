import { randomUUID } from "node:crypto";
import { z } from "zod";
import { JobNameSchema, JobPayloadSchemas, type JobName, type JobPayload } from "./jobs";

/**
 * The envelope every background job uses (CODEBASE.md "Queue Contracts").
 * `payload` is validated separately against the job-specific schema in
 * JobPayloadSchemas — the envelope alone is not a contract.
 */
export const EnvelopeSchema = z.object({
  eventId: z.string().uuid(),
  eventType: JobNameSchema,
  version: z.literal(1),
  occurredAt: z.string().datetime(),
  correlationId: z.string().uuid(),
  causationId: z.string().uuid().nullable(),
  userId: z.string().uuid(),
  repoId: z.string().uuid().nullable(),
  snapshotId: z.string().uuid().nullable(),
  retryCount: z.number().int().min(0).default(0),
  payload: z.unknown(),
});
export type Envelope = z.infer<typeof EnvelopeSchema>;

export interface TypedEnvelope<T extends JobName> extends Omit<Envelope, "eventType" | "payload"> {
  eventType: T;
  payload: JobPayload<T>;
}

export interface BuildEnvelopeInput<T extends JobName> {
  eventType: T;
  payload: JobPayload<T>;
  correlationId: string;
  userId: string;
  causationId?: string | null;
  repoId?: string | null;
  snapshotId?: string | null;
  retryCount?: number;
}

/** Validates the payload against its job schema, then wraps it in a fresh envelope. */
export function buildEnvelope<T extends JobName>(input: BuildEnvelopeInput<T>): TypedEnvelope<T> {
  const payloadSchema = JobPayloadSchemas[input.eventType];
  const payload = payloadSchema.parse(input.payload) as JobPayload<T>;

  return {
    eventId: randomUUID(),
    eventType: input.eventType,
    version: 1,
    occurredAt: new Date().toISOString(),
    correlationId: input.correlationId,
    causationId: input.causationId ?? null,
    userId: input.userId,
    repoId: input.repoId ?? null,
    snapshotId: input.snapshotId ?? null,
    retryCount: input.retryCount ?? 0,
    payload,
  };
}

/** Validates a raw envelope and its payload together against the named job's contract. */
export function parseEnvelope<T extends JobName>(eventType: T, raw: unknown): TypedEnvelope<T> {
  const envelope = EnvelopeSchema.parse(raw);
  if (envelope.eventType !== eventType) {
    throw new Error(`Expected envelope for "${eventType}", got "${envelope.eventType}"`);
  }
  const payload = JobPayloadSchemas[eventType].parse(envelope.payload) as JobPayload<T>;
  return { ...envelope, eventType, payload };
}
