import { z } from "zod";

export const nodeEnvSchema = z.enum(["development", "test", "production"]).default("development");

export const portSchema = z.coerce.number().int().min(1).max(65535);

export const urlSchema = z.string().url();

/** Env vars are always strings — coerce common truthy/falsy spellings explicitly rather than relying on JS truthiness. */
export const booleanFromString = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "1", "yes"].includes(value.toLowerCase());
  return value;
}, z.boolean());

/**
 * Fields every backend deployable needs (RULES.md #20: "All configuration
 * comes from environment variables, validated at startup"). Per-service
 * schemas extend this with their own PORT and DATABASE_URL variable names.
 */
export const backendBaseEnvShape = {
  NODE_ENV: nodeEnvSchema,
  QUEUE_DATABASE_URL: urlSchema,
  REDIS_URL: urlSchema,
  INTERNAL_JWT_SECRET: z.string().min(16, "INTERNAL_JWT_SECRET must be at least 16 characters"),
};
