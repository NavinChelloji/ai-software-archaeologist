import type PgBoss from "pg-boss";
import type { Pool } from "pg";
import {
  buildEnvelope,
  JOB_NAMES,
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
 * Fan-out registry (ADR 0003 "Fan-out to multiple independent consumers of
 * one job requires enqueueing per consumer rather than being free" — pg-boss
 * has no free pub/sub, each `.work()` on a queue name competes for the same
 * jobs). `EVENT_CONTRACTS.md`'s Job Names table lists more than one consumer
 * for a few events (e.g. `repo.snapshot.created` is both a Pipeline
 * bookkeeping input and the Parser module's real trigger); this is the
 * explicit list of the *extra* queue names `publishJob` also sends to,
 * beyond the queue named after the job itself (which the first/bookkeeping
 * consumer already used before fan-out existed, and keeps using unchanged).
 * A module wanting one of these deliveries creates its queue with
 * `ensureProductQueue(boss, jobName, retryPolicy, queueName)` using the
 * matching name here, then `subscribeJob(..., queueName)`.
 */
export const FANOUT_QUEUES: Partial<Record<JobName, readonly string[]>> = {
  "repo.import.requested": ["repo.import.requested.snapshots"],
  "repo.snapshot.created": ["repo.snapshot.created.parser"],
  // GRAPH_SERVICE_PLAN.md "Jobs": the Graph module builds from the same
  // three Parser terminal events Pipeline already consumes for bookkeeping.
  "repo.files.indexed": ["repo.files.indexed.graph"],
  "repo.symbols.extracted": ["repo.symbols.extracted.graph"],
  "repo.dependencies.extracted": ["repo.dependencies.extracted.graph"],
  // DATA_RETENTION_AND_PRIVACY.md "Deletion": both indexer and ai own
  // repo-scoped data and must independently clean up on the same event.
  "repo.deleted": ["repo.deleted.ai"],
  "user.deleted": ["user.deleted.ai"],
  "snapshot.prune": ["snapshot.prune.ai"],
};

/**
 * Every queue name that can exist in `aca_queue` — every job's own
 * (job-named) queue plus every fan-out consumer queue registered for it.
 * Single source of truth for anything that needs to enumerate queues
 * without hand-duplicating this list, e.g. the queue-depth/DLQ-depth
 * metrics sweep (RULES.md #15 "Metrics for ... queue depth, job age").
 */
export function listAllQueueNames(): string[] {
  return JOB_NAMES.flatMap((name) => [name, ...(FANOUT_QUEUES[name] ?? [])]);
}

/**
 * Creates the queue and its dead-letter queue for one documented job name
 * (EVENT_CONTRACTS.md "Retry and Dead Letter": exhausted jobs move to
 * `<job>.dlq`). Call once per job name during service startup. `queueName`
 * defaults to `jobName` for the common single-consumer case; a second (or
 * further) consumer of a fan-out job passes its own name from
 * `FANOUT_QUEUES`.
 */
export async function ensureProductQueue(
  boss: PgBoss,
  jobName: JobName,
  retryPolicy: RetryPolicy,
  queueName: string = jobName
): Promise<void> {
  const deadLetter = `${queueName}.dlq`;
  await boss.createQueue(deadLetter);
  await boss.createQueue(queueName, {
    name: queueName,
    retryLimit: retryPolicy.retryLimit,
    retryDelay: retryPolicy.retryBackoffSeconds,
    retryBackoff: true,
    deadLetter,
  });
}

/**
 * Validates the payload against its job schema, wraps it in an envelope, and
 * enqueues it to the job's own queue plus every queue registered for it in
 * `FANOUT_QUEUES`. `startAfterSeconds` delays delivery — used for
 * stage-retry backoff. Throws if any target queue declines (most likely
 * because its consumer never called `ensureProductQueue` for that name) —
 * a silently dropped queue is exactly the class of bug fan-out makes
 * possible, so this fails loudly rather than losing the event.
 */
export async function publishJob<T extends JobName>(
  boss: PgBoss,
  input: BuildEnvelopeInput<T>,
  startAfterSeconds?: number
): Promise<void> {
  const envelope = buildEnvelope(input);
  const options = startAfterSeconds ? { startAfter: startAfterSeconds } : {};
  const queueNames = [input.eventType, ...(FANOUT_QUEUES[input.eventType] ?? [])];

  const jobIds = await Promise.all(queueNames.map((name) => boss.send(name, envelope, options)));
  if (jobIds.some((id) => !id)) {
    throw new Error(`pg-boss declined to enqueue "${input.eventType}" on one or more of: ${queueNames.join(", ")}`);
  }
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
 * `queueName` defaults to `jobName`; a fan-out consumer (see
 * `FANOUT_QUEUES`) passes its own registered queue name here while still
 * validating the payload against `jobName`'s schema.
 */
export async function subscribeJob<T extends JobName>(
  boss: PgBoss,
  jobName: T,
  options: SubscribeOptions,
  handler: JobHandler<T>,
  queueName: string = jobName
): Promise<void> {
  await boss.work<Record<string, unknown>>(queueName, async (jobs) => {
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
