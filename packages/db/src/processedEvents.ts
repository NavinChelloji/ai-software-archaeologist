import type { Pool, PoolClient } from "pg";

const UNIQUE_VIOLATION = "23505";

/**
 * Inserts (eventId, consumer) into this database's `processed_events`
 * table. Returns false if the row already existed (unique violation =>
 * already handled, no-op), true the first time. This is the idempotency
 * pattern from CODEBASE.md "Idempotency" — identical in every deployable,
 * each against its own database.
 */
export async function markEventProcessed(
  client: Pool | PoolClient,
  eventId: string,
  consumer: string
): Promise<boolean> {
  try {
    await client.query("INSERT INTO processed_events (event_id, consumer) VALUES ($1, $2)", [
      eventId,
      consumer,
    ]);
    return true;
  } catch (err) {
    if (isUniqueViolation(err)) {
      return false;
    }
    throw err;
  }
}

function isUniqueViolation(err: unknown): err is { code: string } {
  return typeof err === "object" && err !== null && "code" in err && err.code === UNIQUE_VIOLATION;
}
