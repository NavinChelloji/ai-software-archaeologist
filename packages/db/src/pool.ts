import { Pool, type PoolConfig } from "pg";

/** One pool per deployable process; close it on graceful shutdown (RULES.md #9). */
export function createPool(connectionString: string, options: Partial<PoolConfig> = {}): Pool {
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ...options,
  });
}

/** Used by /health/ready — verifies the real dependency, not just that the pool object exists. */
export async function checkPoolHealth(pool: Pool): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
