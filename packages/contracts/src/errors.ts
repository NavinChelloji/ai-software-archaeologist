import { z } from "zod";

/**
 * The full code registry from API_ERROR_CODES.md. A test in this package
 * asserts this list's length and the HTTP_STATUS_BY_CODE map stay in sync,
 * so a new code can't be added without being documented (and vice versa).
 */
export const ERROR_CODES = [
  // Authentication
  "AUTH_REQUIRED",
  "AUTH_TOKEN_EXPIRED",
  "AUTH_REFRESH_INVALID",
  "AUTH_SESSION_REVOKED",
  "OAUTH_STATE_INVALID",
  "OAUTH_EXCHANGE_FAILED",
  "GITHUB_RECONNECT_REQUIRED",
  "INTERNAL_TOKEN_INVALID",
  // Repositories and Import
  "REPO_NOT_FOUND",
  "REPO_FORBIDDEN",
  "REPO_ALREADY_IMPORTING",
  "REPO_TOO_LARGE",
  "REPO_TOO_MANY_FILES",
  "REPO_LIMIT_REACHED",
  "REPO_NOT_READY",
  "REPO_EMPTY",
  "GITHUB_ACCESS_DENIED",
  "GITHUB_RATE_LIMITED",
  // Indexing
  "SNAPSHOT_DOWNLOAD_FAILED",
  "ARCHIVE_UNSAFE",
  "PARSE_FAILED",
  "STAGE_TIMEOUT",
  "LANGUAGE_UNSUPPORTED",
  "JOB_NOT_FOUND",
  // Graphs and Files
  "GRAPH_NOT_BUILT",
  "NODE_NOT_FOUND",
  "FILE_NOT_FOUND",
  "FILE_CONTENT_UNAVAILABLE",
  "RANGE_INVALID",
  // Chat and Retrieval
  "CONVERSATION_NOT_FOUND",
  "CONVERSATION_FORBIDDEN",
  "MESSAGE_TOO_LONG",
  "NO_CONTEXT_FOUND",
  "LLM_TIMEOUT",
  "LLM_RATE_LIMITED",
  "LLM_PROVIDER_ERROR",
  "EMBEDDING_FAILED",
  // Quotas and Limits
  "RATE_LIMITED",
  "QUOTA_CHAT_TOKENS",
  "QUOTA_EMBEDDING_TOKENS",
  "QUOTA_IMPORTS",
  // Generic
  "VALIDATION_FAILED",
  "NOT_FOUND",
  "CONFLICT",
  "DEPENDENCY_UNAVAILABLE",
  "INTERNAL_ERROR",
] as const;

export const ErrorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

/** HTTP status mapping from API_ERROR_CODES.md. NO_CONTEXT_FOUND is 200 — a successful, honest answer, not a failure. */
export const HTTP_STATUS_BY_CODE: Record<ErrorCode, number> = {
  AUTH_REQUIRED: 401,
  AUTH_TOKEN_EXPIRED: 401,
  AUTH_REFRESH_INVALID: 401,
  AUTH_SESSION_REVOKED: 401,
  OAUTH_STATE_INVALID: 400,
  OAUTH_EXCHANGE_FAILED: 503,
  GITHUB_RECONNECT_REQUIRED: 403,
  INTERNAL_TOKEN_INVALID: 401,

  REPO_NOT_FOUND: 404,
  REPO_FORBIDDEN: 403,
  REPO_ALREADY_IMPORTING: 409,
  REPO_TOO_LARGE: 422,
  REPO_TOO_MANY_FILES: 422,
  REPO_LIMIT_REACHED: 402,
  REPO_NOT_READY: 409,
  REPO_EMPTY: 422,
  GITHUB_ACCESS_DENIED: 403,
  GITHUB_RATE_LIMITED: 503,

  SNAPSHOT_DOWNLOAD_FAILED: 503,
  ARCHIVE_UNSAFE: 422,
  PARSE_FAILED: 500,
  STAGE_TIMEOUT: 503,
  LANGUAGE_UNSUPPORTED: 422,
  JOB_NOT_FOUND: 404,

  GRAPH_NOT_BUILT: 409,
  NODE_NOT_FOUND: 404,
  FILE_NOT_FOUND: 404,
  FILE_CONTENT_UNAVAILABLE: 503,
  RANGE_INVALID: 400,

  CONVERSATION_NOT_FOUND: 404,
  CONVERSATION_FORBIDDEN: 403,
  MESSAGE_TOO_LONG: 400,
  NO_CONTEXT_FOUND: 200,
  LLM_TIMEOUT: 503,
  LLM_RATE_LIMITED: 503,
  LLM_PROVIDER_ERROR: 503,
  EMBEDDING_FAILED: 503,

  RATE_LIMITED: 429,
  QUOTA_CHAT_TOKENS: 402,
  QUOTA_EMBEDDING_TOKENS: 402,
  QUOTA_IMPORTS: 402,

  VALIDATION_FAILED: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  DEPENDENCY_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

/** Codes that are safe to retry by default when the call site doesn't say otherwise. */
const DEFAULT_RETRYABLE: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  "OAUTH_EXCHANGE_FAILED",
  "GITHUB_RATE_LIMITED",
  "SNAPSHOT_DOWNLOAD_FAILED",
  "STAGE_TIMEOUT",
  "FILE_CONTENT_UNAVAILABLE",
  "LLM_TIMEOUT",
  "LLM_RATE_LIMITED",
  "LLM_PROVIDER_ERROR",
  "EMBEDDING_FAILED",
  "DEPENDENCY_UNAVAILABLE",
  "RATE_LIMITED",
]);

export const ErrorEnvelopeSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    correlationId: z.string().uuid(),
    details: z.record(z.string(), z.unknown()).optional(),
    retryable: z.boolean(),
  }),
});
export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;

export interface AppErrorOptions {
  details?: Record<string, unknown>;
  retryable?: boolean;
  cause?: unknown;
}

/**
 * Typed application error every deployable converts unknown errors into
 * (RULES.md #8), and the shape a global exception filter maps 1:1 onto
 * ErrorEnvelopeSchema. `message` must be safe to show a user.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;
  readonly retryable: boolean;

  constructor(code: ErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.status = HTTP_STATUS_BY_CODE[code];
    this.details = options.details;
    this.retryable = options.retryable ?? DEFAULT_RETRYABLE.has(code);
  }

  toEnvelope(correlationId: string): ErrorEnvelope {
    return {
      error: {
        code: this.code,
        message: this.message,
        correlationId,
        details: this.details,
        retryable: this.retryable,
      },
    };
  }
}
