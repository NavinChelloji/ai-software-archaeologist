# API Error Contract and Codes

## Error Envelope

Every non-2xx response from `/api/v1` uses exactly this shape. It is defined once in `packages/contracts` and returned by a global exception filter.

```json
{
  "error": {
    "code": "REPO_TOO_LARGE",
    "message": "This repository is 812 MB, which is above the 500 MB limit.",
    "correlationId": "8f1e...",
    "details": { "sizeMb": 812, "limitMb": 500 },
    "retryable": false
  }
}
```

Rules:

- `code` is a stable `SCREAMING_SNAKE_CASE` identifier. Clients branch on `code`, never on `message`.
- `message` is safe to show a user: no stack traces, no SQL, no file contents, no tokens.
- `correlationId` is always present, and the web app displays it in error states so users can quote it.
- `details` is optional and structured; the web app may use it to build a better message.
- `retryable` tells the client whether retrying the same request could succeed.

Internal detail goes to logs, never to the response.

## HTTP Status Mapping

| Status | Use |
| --- | --- |
| 400 | Validation failure, malformed input |
| 401 | Missing, expired, or invalid access token |
| 403 | Authenticated but not permitted (ownership, scope) |
| 404 | Resource does not exist for this user |
| 409 | Conflict (import already running, duplicate) |
| 402 | Quota exhausted |
| 422 | Semantically invalid (unsupported language for an operation) |
| 429 | Rate limited — always with `Retry-After` |
| 503 | Dependency unavailable (provider, database, storage) |
| 500 | Unexpected — always logged with the correlation ID |

**Ownership rule:** a repository that exists but belongs to another user returns `403 REPO_FORBIDDEN`, and a repository that does not exist returns `404 REPO_NOT_FOUND`, with identical timing characteristics. Do not vary latency or shape between the two, and do not return `404` for both — the first leaks nothing useful, and consistency matters more than obscurity here.

## Codes

### Authentication

| Code | Status | Meaning |
| --- | --- | --- |
| `AUTH_REQUIRED` | 401 | No valid access token |
| `AUTH_TOKEN_EXPIRED` | 401 | Access token expired; refresh and retry |
| `AUTH_REFRESH_INVALID` | 401 | Refresh token invalid, expired, or already used |
| `AUTH_SESSION_REVOKED` | 401 | Session was revoked; sign in again |
| `OAUTH_STATE_INVALID` | 400 | OAuth state missing, expired, or replayed |
| `OAUTH_EXCHANGE_FAILED` | 503 | GitHub rejected the code exchange |
| `GITHUB_RECONNECT_REQUIRED` | 403 | GitHub token expired and could not be refreshed |
| `INTERNAL_TOKEN_INVALID` | 401 | Internal service token missing or invalid (never seen by browsers) |

### Repositories and Import

| Code | Status | Meaning |
| --- | --- | --- |
| `REPO_NOT_FOUND` | 404 | No such repository |
| `REPO_FORBIDDEN` | 403 | Repository belongs to another user |
| `REPO_ALREADY_IMPORTING` | 409 | An indexing job is already running |
| `REPO_TOO_LARGE` | 422 | Above `MAX_REPOSITORY_ARCHIVE_MB` |
| `REPO_TOO_MANY_FILES` | 422 | Above `MAX_FILES_PER_REPO` |
| `REPO_LIMIT_REACHED` | 402 | User is at `MAX_REPOSITORIES_PER_USER` |
| `REPO_NOT_READY` | 409 | Indexing has not completed; graphs and chat unavailable |
| `REPO_EMPTY` | 422 | No indexable files after filtering |
| `GITHUB_ACCESS_DENIED` | 403 | The GitHub App has no access to this repository |
| `GITHUB_RATE_LIMITED` | 503 | GitHub rate limit hit; `Retry-After` set |

### Indexing

| Code | Status | Meaning |
| --- | --- | --- |
| `SNAPSHOT_DOWNLOAD_FAILED` | 503 | Tarball download failed (retryable) |
| `ARCHIVE_UNSAFE` | 422 | Archive contained traversal, symlinks, or a bomb (never retryable) |
| `PARSE_FAILED` | 500 | Parser crashed on this snapshot |
| `STAGE_TIMEOUT` | 503 | A stage exceeded `STAGE_TIMEOUT_SECONDS` |
| `LANGUAGE_UNSUPPORTED` | 422 | Requested graph is unavailable for this repository's languages |
| `JOB_NOT_FOUND` | 404 | No such job |

### Graphs and Files

| Code | Status | Meaning |
| --- | --- | --- |
| `GRAPH_NOT_BUILT` | 409 | Graph does not exist for the active snapshot |
| `NODE_NOT_FOUND` | 404 | No such graph node |
| `FILE_NOT_FOUND` | 404 | No such file in the active snapshot |
| `FILE_CONTENT_UNAVAILABLE` | 503 | Object storage read failed |
| `RANGE_INVALID` | 400 | Requested line range is outside the file |

### Chat and Retrieval

| Code | Status | Meaning |
| --- | --- | --- |
| `CONVERSATION_NOT_FOUND` | 404 | No such conversation |
| `CONVERSATION_FORBIDDEN` | 403 | Conversation belongs to another user |
| `MESSAGE_TOO_LONG` | 400 | Above the input token limit |
| `NO_CONTEXT_FOUND` | 200 | *Not an error* — returned in the answer body as an honest "not in this repository" |
| `LLM_TIMEOUT` | 503 | Provider exceeded `LLM_REQUEST_TIMEOUT_MS` |
| `LLM_RATE_LIMITED` | 503 | Provider rate limit; `Retry-After` set |
| `LLM_PROVIDER_ERROR` | 503 | Provider returned an error |
| `EMBEDDING_FAILED` | 503 | Embedding provider failed |

`NO_CONTEXT_FOUND` is listed here deliberately: retrieving nothing is a **successful** answer, not a failure. Returning an error for it teaches the UI to hide the most honest thing the assistant can say.

### Quotas and Limits

| Code | Status | Meaning |
| --- | --- | --- |
| `RATE_LIMITED` | 429 | Endpoint rate limit; `Retry-After` set |
| `QUOTA_CHAT_TOKENS` | 402 | Monthly chat token budget exhausted |
| `QUOTA_EMBEDDING_TOKENS` | 402 | Monthly embedding token budget exhausted |
| `QUOTA_IMPORTS` | 402 | Import quota exhausted |

Quotas are checked **before** any paid downstream call, so a rejected request never costs money.

### Generic

| Code | Status | Meaning |
| --- | --- | --- |
| `VALIDATION_FAILED` | 400 | Request failed schema validation; `details` lists field errors |
| `NOT_FOUND` | 404 | Generic |
| `CONFLICT` | 409 | Generic |
| `DEPENDENCY_UNAVAILABLE` | 503 | Database, Redis, queue, or storage unreachable |
| `INTERNAL_ERROR` | 500 | Unexpected; correlation ID logged |

## Client Handling Guidance

| Code class | Web app behaviour |
| --- | --- |
| `AUTH_TOKEN_EXPIRED` | Refresh once, retry once, then redirect to sign-in |
| `GITHUB_RECONNECT_REQUIRED` | Show a "Reconnect GitHub" prompt, not an error toast |
| `REPO_NOT_READY` | Route to the indexing progress view |
| `LANGUAGE_UNSUPPORTED` | Render the explanatory empty state, keep other tabs working |
| `QUOTA_*` | Show what limit was hit and when it resets |
| `RATE_LIMITED` | Back off using `Retry-After`, show a countdown |
| `503` codes | Offer retry; do not clear the user's input |

## Implementation Notes

- A single NestJS exception filter maps typed application errors to this envelope. Controllers never build error responses by hand.
- Every code in this document has a corresponding entry in a `ErrorCode` union in `packages/contracts`, and a test asserts the two lists match — so a new code cannot be added in code without being documented.
- Unmapped exceptions become `INTERNAL_ERROR` and are logged at `error` with full context.
