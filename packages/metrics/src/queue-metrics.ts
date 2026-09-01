import { Gauge, type Registry } from "prom-client";

export interface QueueMetrics {
  queueDepth: Gauge<"queue">;
  dlqDepth: Gauge<"queue">;
  oldestJobAgeSeconds: Gauge<"status">;
}

/**
 * Queue depth, DLQ arrivals, and job age (RULES.md #15, #22 "Alerts for high
 * error rate, DLQ arrivals, stalled jobs"). `dlqDepth` is the metric an
 * alert rule watches: any non-zero value is a bug or an outage, never
 * routine (EVENT_CONTRACTS.md "Retry and Dead Letter").
 */
export function createQueueMetrics(registry: Registry): QueueMetrics {
  const queueDepth = new Gauge({
    name: "queue_depth",
    help: "Number of jobs waiting in a pg-boss queue.",
    labelNames: ["queue"],
    registers: [registry],
  });

  const dlqDepth = new Gauge({
    name: "queue_dlq_depth",
    help: "Number of jobs in a queue's dead-letter queue. Any non-zero value should page.",
    labelNames: ["queue"],
    registers: [registry],
  });

  const oldestJobAgeSeconds = new Gauge({
    name: "oldest_job_age_seconds",
    help: "Age in seconds of the oldest non-terminal processing job, by status.",
    labelNames: ["status"],
    registers: [registry],
  });

  return { queueDepth, dlqDepth, oldestJobAgeSeconds };
}
