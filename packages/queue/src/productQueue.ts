import type PgBoss from "pg-boss";
import type { Pool } from "pg";
import {
  buildEnvelope,
  parseEnvelope,
  type BuildEnvelopeInput,
  type JobName,
  type TypedEnvelope,
} from "@aca/contracts";
import { markEventProcessed } from "@aca/db";
import type { Logger } from "@aca/logger";
import type { RetryPolicy } from "./boss";

/** Exponential backoff in seconds for the Nth stage-level retry (JOB_ORCHESTRATOR_SERVICE_PLAN.md "Failure ownership"). */
export function retryBackoffSeconds(retryCount: number, baseSeconds: number): number {
  return baseSeconds * 2 ** Math.max(retryCount - 1, 0);
}

/**
 * Creates the queue and its dead-letter queue for one documented job name
 * (EVENT_CONTRACTS.md "Retry and Dead Letter": exhausted jobs move to
 * `<job>.dlq`). Call once per job name during service startup.
 */
export async function ensureProductQueue(
  boss: PgBoss,
  jobName: JobName,
  retryPolicy: RetryPolicy
): Promise<void> {
  const deadLetter = `${jobName}.dlq`;
  await boss.createQueue(deadLetter);
  await boss.createQueue(jobName, {
    name: jobName,
    retryLimit: retryPolicy.retryLimit,
    retryDelay: retryPolicy.retryBackoffSeconds,
    retryBackoff: true,
    deadLetter,
  });
}

/** Validates the payload against its job schema, wraps it in an envelope, and enqueues it. `startAfterSeconds` delays delivery — used for stage-retry backoff. */
export async function publishJob<T extends JobName>(
  boss: PgBoss,
  input: BuildEnvelopeInput<T>,
  startAfterSeconds?: number
): Promise<string> {
  const envelope = buildEnvelope(input);
  const jobId = await boss.send(
    input.eventType,
    envelope,
    startAfterSeconds ? { startAfter: startAfterSeconds } : {}
  );
  if (!jobId) {
    throw new Error(`pg-boss declined to enqueue "${input.eventType}"`);
  }
  return jobId;
}

export interface SubscribeOptions {
  /** "<deployable>.<module>.<handler>" — see EVENT_CONTRACTS.md Idempotency. */
  consumer: string;
  pool: Pool;
  logger: Logger;
}

export type JobHandler<T extends JobName> = (envelope: TypedEnvelope<T>) => Promise<void>;

/**
 * Subscribes to a job name: validates the envelope and payload against
 * `@aca/contracts` on receipt, skips work already recorded in
 * `processed_events` for this consumer, and only then calls `handler`.
 */
export async function subscribeJob<T extends JobName>(
  boss: PgBoss,
  jobName: T,
  options: SubscribeOptions,
  handler: JobHandler<T>
): Promise<void> {
  await boss.work<Record<string, unknown>>(jobName, async (jobs) => {
    for (const job of jobs) {
      const envelope = parseEnvelope(jobName, job.data);

      const isFirstDelivery = await markEventProcessed(options.pool, envelope.eventId, options.consumer);
      if (!isFirstDelivery) {
        options.logger.info(
          { eventId: envelope.eventId, jobName, consumer: options.consumer },
          "duplicate job delivery, skipping"
        );
        continue;
      }

      await handler(envelope);
    }
  });
}
