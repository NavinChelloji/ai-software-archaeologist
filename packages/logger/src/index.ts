import pino, { type Logger } from "pino";

export type { Logger } from "pino";

/**
 * Never logged, per RULES.md #7: passwords, access/refresh tokens, OAuth
 * codes, GitHub tokens, private keys, secrets. Paths use pino's wildcard
 * syntax so a field is redacted no matter how deep it appears.
 */
const REDACT_PATHS = [
  "*.password",
  "*.token",
  "*.accessToken",
  "*.refreshToken",
  "*.githubToken",
  "*.secret",
  "*.privateKey",
  "*.clientSecret",
  "*.authorization",
  "req.headers.authorization",
  "req.headers.cookie",
];

export interface CreateLoggerOptions {
  service: string;
  module?: string;
  level?: string;
}

/** One structured JSON logger per process, carrying `service`/`module` on every line (RULES.md #7). */
export function createLogger(options: CreateLoggerOptions): Logger {
  const isProduction = process.env.NODE_ENV === "production";

  return pino({
    level: options.level ?? process.env.LOG_LEVEL ?? "info",
    base: { service: options.service, module: options.module },
    redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
    transport: isProduction
      ? undefined
      : { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } },
  });
}

export interface LogContext {
  requestId?: string;
  correlationId?: string;
  causationId?: string;
  userId?: string;
  repoId?: string;
  snapshotId?: string;
  jobId?: string;
  conversationId?: string;
}

/** Binds request/pipeline identifiers onto every subsequent log line without repeating them at each call site. */
export function withContext(logger: Logger, context: LogContext): Logger {
  return logger.child(context);
}
