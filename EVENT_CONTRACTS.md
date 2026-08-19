# Event and Job Contracts

Every background job in the system uses one envelope and a job-specific payload. The schemas here are authoritative; `packages/contracts` holds the Zod definitions and the TypeScript types derived from them. Payloads are validated **before enqueue and again on receipt** — a malformed payload fails fast rather than half-processing.

The envelope alone is not a contract. The payloads below are what services actually disagree about, which is why they live in one document.

## Envelope

```ts
const Envelope = z.object({
  eventId:       z.string().uuid(),
  eventType:     JobName,
  version:       z.literal(1),
  occurredAt:    z.string().datetime(),
  correlationId: z.string().uuid(),
  causationId:   z.string().uuid().nullable(),
  userId:        z.string().uuid(),
  repoId:        z.string().uuid().nullable(),
  snapshotId:    z.string().uuid().nullable(),
  retryCount:    z.number().int().min(0).default(0),
  payload:       z.unknown(),
});
```

- `correlationId` is created at the originating HTTP request and copied through the whole pipeline.
- `causationId` is the `eventId` of the job that caused this one — this is what lets you reconstruct a pipeline run from logs.
- `version` is bumped only for breaking payload changes; consumers must handle both versions during a rollout.

## Job Names

| Job | Producer | Consumer |
| --- | --- | --- |
| `repo.import.requested` | api | indexer / repositories |
| `repo.snapshot.created` | indexer / repositories | indexer / parser, indexer / pipeline |
| `repo.files.indexed` | indexer / parser | indexer / graph, indexer / pipeline |
| `repo.symbols.extracted` | indexer / parser | indexer / graph, indexer / pipeline |
| `repo.dependencies.extracted` | indexer / parser | indexer / graph, indexer / pipeline |
| `repo.graph.built` | indexer / graph | indexer / pipeline |
| `repo.index.requested` | indexer / pipeline | ai / retrieval |
| `repo.embeddings.completed` | ai / retrieval | indexer / pipeline |
| `repo.stage.failed` | any worker | indexer / pipeline |
| `repo.processing.completed` | indexer / pipeline | api (via Redis), analytics |
| `repo.processing.failed` | indexer / pipeline | api (via Redis), analytics |
| `chat.answer.completed` | ai / chat | analytics only |
| `repo.deleted` | api | indexer, ai |
| `user.deleted` | api | indexer, ai |
| `snapshot.prune` | scheduler | indexer, ai |

## Stage Progress Fields

Every stage-producing job carries these on its payload. The pipeline advances **only** when `batchIndex === batchCount - 1`.

```ts
const StageProgress = z.object({
  stage:          z.enum(["snapshotting","extracting","parsing","graphing","embedding"]),
  batchIndex:     z.number().int().min(0),
  batchCount:     z.number().int().min(1),
  itemsProcessed: z.number().int().min(0),
  totalItems:     z.number().int().min(0),
  durationMs:     z.number().int().min(0),
});
```

## Payloads

### `repo.import.requested`

```ts
{
  provider: "github",
  providerRepoId: string,
  fullName: string,          // "owner/name"
  defaultBranch: string,
  isPrivate: boolean,
  ref: string | null,        // null = default branch head
  reindex: boolean,
}
```

### `repo.snapshot.created`

```ts
{
  commitSha: string,
  ref: string,
  archiveKey: string,        // S3 key, never the archive itself
  sizeBytes: number,
  reused: boolean,           // true when an existing snapshot for this SHA was reused
  ...StageProgress
}
```

### `repo.files.indexed`

```ts
{
  commitSha: string,
  manifestKey: string,       // S3 key of manifest.json
  fileCount: number,
  skippedCount: number,
  skippedReasons: Record<"ignored"|"binary"|"too_large"|"excluded_secret"|"generated", number>,
  languages: Record<string, number>,
  ...StageProgress
}
```

### `repo.symbols.extracted`

```ts
{
  commitSha: string,
  symbolCount: number,
  languageSupported: boolean,   // false => zero symbols is expected, not a failure
  byType: Record<"class"|"interface"|"function"|"method"|"type"|"enum"|"variable", number>,
  ...StageProgress
}
```

### `repo.dependencies.extracted`

```ts
{
  commitSha: string,
  edgeCount: number,
  languageSupported: boolean,
  byResolution: Record<"resolved"|"external"|"unresolved"|"dynamic_unresolvable", number>,
  ...StageProgress
}
```

### `repo.graph.built`

```ts
{
  commitSha: string,
  graphs: {
    folder:     { nodes: number, edges: number },
    dependency: { nodes: number, edges: number },
    symbol:     { nodes: number, edges: number },
  },
  ...StageProgress
}
```

### `repo.index.requested`

```ts
{
  commitSha: string,
  manifestKey: string,
  previousSnapshotId: string | null,   // enables content-hash diffing for embedding reuse
}
```

### `repo.embeddings.completed`

```ts
{
  commitSha: string,
  chunkCount: number,
  embeddedCount: number,
  reusedCount: number,
  promptTokens: number,
  embeddingModel: string,
  ...StageProgress
}
```

### `repo.stage.failed`

```ts
{
  stage: "snapshotting"|"extracting"|"parsing"|"graphing"|"embedding",
  errorCode: string,             // from API_ERROR_CODES.md
  message: string,               // safe, no secrets, no source content
  retryable: boolean,
  detail: Record<string, unknown>,
}
```

Workers emit this. Only the pipeline module emits the terminal `repo.processing.failed`, so no consumer can receive its own failure event.

### `repo.processing.completed`

```ts
{
  commitSha: string,
  jobId: string,
  durationMs: number,
  fileCount: number,
  symbolCount: number,
  chunkCount: number,
}
```

### `repo.processing.failed`

```ts
{
  jobId: string,
  stage: string,
  errorCode: string,
  message: string,
  retryCount: number,
}
```

### `chat.answer.completed`

```ts
{
  conversationId: string,
  messageId: string,
  snapshotId: string,
  model: string,
  promptTokens: number,
  completionTokens: number,
  citationCount: number,
  latencyMs: number,
}
```

Analytics only. Nothing user-facing waits on this — chat answers stream synchronously.

### `repo.deleted` / `user.deleted`

```ts
// repo.deleted
{ repoId: string, reason: "user_request" | "account_deletion" }

// user.deleted
{ userId: string, repoIds: string[] }
```

### `snapshot.prune`

```ts
{ repoId: string, retainCount: number }
```

## Idempotency

Every consumer, in every deployable, inserts into its own `processed_events` table before doing work:

```sql
INSERT INTO processed_events (event_id, consumer) VALUES ($1, $2);
-- unique violation => already handled, return success
```

`consumer` is `"<deployable>.<module>.<handler>"`, so the same event can be legitimately handled once by each interested consumer.

## Retry and Dead Letter

- pg-boss retries with exponential backoff from `RETRY_BACKOFF_BASE_SECONDS`, up to `MAX_RETRY_COUNT`.
- Only jobs whose failure was `retryable: true` are retried.
- Exhausted jobs move to `<job>.dlq` and raise an alert.
- A DLQ arrival is always a bug or an outage — it should never be routine.

## Versioning Rules

- Adding an optional field is not breaking; bump nothing.
- Removing a field, renaming one, or changing a type is breaking; introduce `version: 2` and have consumers accept both until the old version drains.
- Never reuse a job name with different semantics.
- Schema changes are reviewed like API changes, because they are.

## Testing

For every job name, a contract test asserts that:

1. the producer's emitted payload validates against the schema;
2. the consumer's handler accepts a fixture built from the schema;
3. duplicate delivery is a no-op;
4. an invalid payload is rejected before any side effect.
