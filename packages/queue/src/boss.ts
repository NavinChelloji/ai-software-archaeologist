import PgBoss from "pg-boss";
import type { Logger } from "@aca/logger";

export interface RetryPolicy {
  /** SCOPE_LIMITS.md MAX_RETRY_COUNT */
  retryLimit: number;
  /** SCOPE_LIMITS.md RETRY_BACKOFF_BASE_SECONDS */
  retryBackoffSeconds: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  retryLimit: 3,
  retryBackoffSeconds: 30,
};

export function createBoss(connectionString: string): PgBoss {
  return new PgBoss({ connectionString });
}

/** Surfaces pg-boss's internal error events on the deployable's own logger instead of letting them go unhandled. */
export function attachErrorLogging(boss: PgBoss, logger: Logger): void {
  boss.on("error", (err) => logger.error({ err }, "pg-boss error"));
}

export async function startBoss(boss: PgBoss): Promise<void> {
  await boss.start();
}

/** Call during graceful shutdown so in-flight jobs are allowed to finish (RULES.md #4). */
export async function stopBoss(boss: PgBoss): Promise<void> {
  await boss.stop({ graceful: true });
}
