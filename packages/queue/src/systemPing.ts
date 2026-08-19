import type PgBoss from "pg-boss";
import { z } from "zod";
import { markEventProcessed } from "@aca/db";
import type { SubscribeOptions } from "./productQueue";

/**
 * `system.health.ping` is infrastructure scaffolding for Stage 1's exit
 * criterion — "a trivial pg-boss job can be enqueued in api and consumed
 * in indexer" — proving the queue, idempotency table, and worker role all
 * wire together end to end. It is deliberately NOT one of the 15 job names
 * in EVENT_CONTRACTS.md and must never be treated as a product job.
 */
export const SYSTEM_PING_JOB = "system.health.ping";

export const SystemPingPayloadSchema = z.object({
  pingId: z.string().uuid(),
  sentAt: z.string().datetime(),
  message: z.string(),
});
export type SystemPingPayload = z.infer<typeof SystemPingPayloadSchema>;

export async function ensureSystemPingQueue(boss: PgBoss): Promise<void> {
  await boss.createQueue(SYSTEM_PING_JOB);
}

export async function publishSystemPing(boss: PgBoss, payload: SystemPingPayload): Promise<string> {
  const parsed = SystemPingPayloadSchema.parse(payload);
  const jobId = await boss.send(SYSTEM_PING_JOB, parsed);
  if (!jobId) {
    throw new Error(`pg-boss declined to enqueue "${SYSTEM_PING_JOB}"`);
  }
  return jobId;
}

export type SystemPingHandler = (payload: SystemPingPayload, jobId: string) => Promise<void>;

export async function subscribeSystemPing(
  boss: PgBoss,
  options: SubscribeOptions,
  handler: SystemPingHandler
): Promise<void> {
  await boss.work<SystemPingPayload>(SYSTEM_PING_JOB, async (jobs) => {
    for (const job of jobs) {
      const payload = SystemPingPayloadSchema.parse(job.data);

      const isFirstDelivery = await markEventProcessed(options.pool, job.id, options.consumer);
      if (!isFirstDelivery) {
        options.logger.info({ jobId: job.id, consumer: options.consumer }, "duplicate ping, skipping");
        continue;
      }

      await handler(payload, job.id);
    }
  });
}
