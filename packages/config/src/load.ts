import type { z } from "zod";

/**
 * Parses `source` (defaults to process.env) against `schema`. On failure,
 * prints every violated field and exits — "fail fast at startup when
 * required environment variables are missing or malformed" (RULES.md #8).
 */
export function loadEnv<Schema extends z.ZodTypeAny>(
  schema: Schema,
  source: NodeJS.ProcessEnv = process.env
): z.infer<Schema> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    console.error(`Invalid environment configuration:\n${issues}`);
    process.exit(1);
  }
  return result.data;
}
