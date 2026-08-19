import type { Pool, PoolClient, QueryResultRow } from "pg";

/** Always parameterized — never build SQL through string concatenation (RULES.md #10). */
export async function query<T extends QueryResultRow = QueryResultRow>(
  client: Pool | PoolClient,
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await client.query<T>(text, params);
  return result.rows;
}
