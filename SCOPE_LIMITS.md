# Scope Limits, Quotas, and Defaults

Every limit the architecture references has a value here. A limit without a number is not a limit — the original plans named several environment variables (`MAX_REPOSITORY_SIZE_MB`, `GRAPH_QUERY_MAX_NODES`, `RATE_LIMIT_*`) without ever stating what they should be, which means each would have been guessed differently in each service.

These are v1 defaults for a single-tenant deployment on modest hardware. Change them deliberately, in this file first.

## Repository Limits

| Limit | Variable | Default | Rationale |
| --- | --- | --- | --- |
| Archive size | `MAX_REPOSITORY_ARCHIVE_MB` | 500 | Above this, download and extraction dominate the pipeline |
| Extracted size | `MAX_EXTRACTED_SIZE_MB` | 2048 | Zip-bomb defence; enforced cumulatively during extraction |
| File count | `MAX_FILES_PER_REPO` | 20000 | Beyond this the graph is unusable and embedding cost is unjustifiable |
| Single file size | `MAX_FILE_SIZE_KB` | 512 | Larger files are almost always generated or vendored |
| Directory depth | `MAX_DIRECTORY_DEPTH` | 32 | Prevents pathological recursion |
| Repositories per user | `MAX_REPOSITORIES_PER_USER` | 10 | Cost containment; raise per plan later |
| Snapshot retention | `SNAPSHOT_RETENTION_COUNT` | 2 | Current plus one for rollback |

All of these are checked **before** work begins where possible. `REPO_TOO_LARGE` at import is a good experience; failing at 60% is not.

## Processing Limits

| Limit | Variable | Default |
| --- | --- | --- |
| Whole-job timeout | `PROCESSING_TIMEOUT_SECONDS` | 1800 |
| Per-stage timeout | `STAGE_TIMEOUT_SECONDS` | 1800 |
| Per-file parse timeout | `PARSER_FILE_TIMEOUT_MS` | 10000 |
| Parser concurrency | `PARSER_CONCURRENCY` | 4 |
| Parser insert batch | `PARSER_BATCH_SIZE` | 500 |
| Download timeout | `DOWNLOAD_TIMEOUT_SECONDS` | 600 |
| Max retries per stage | `MAX_RETRY_COUNT` | 3 |
| Retry backoff base | `RETRY_BACKOFF_BASE_SECONDS` | 30 |
| Stalled job sweep | `STALLED_JOB_SWEEP_SECONDS` | 60 |

## Graph Limits

| Limit | Variable | Default | Rationale |
| --- | --- | --- | --- |
| Nodes per response | `GRAPH_QUERY_MAX_NODES` | 1500 | React Flow degrades badly beyond roughly 2000 nodes |
| Neighbour expansion depth | `GRAPH_NEIGHBOR_MAX_DEPTH` | 3 | Depth 4+ returns most of the repository |
| Graph cache TTL | `GRAPH_CACHE_TTL_SECONDS` | 300 | Keys include `snapshotId`, so staleness is bounded anyway |
| Build batch size | `GRAPH_BUILD_BATCH_SIZE` | 2000 |

When a graph is truncated the response says so and reports the real total. Silent truncation is a correctness bug, not a performance optimization.

## Retrieval and Embedding Limits

| Limit | Variable | Default |
| --- | --- | --- |
| Chunk size | `CHUNK_MAX_TOKENS` | 512 |
| Chunk overlap | `CHUNK_OVERLAP_TOKENS` | 64 |
| Embedding batch | `EMBEDDING_BATCH_SIZE` | 96 |
| Embedding concurrency | `EMBEDDING_CONCURRENCY` | 4 |
| Retrieval candidates | `RETRIEVAL_TOP_K` | 40 |
| Retrieval final | `RETRIEVAL_FINAL_K` | 16 |
| Minimum score | `RETRIEVAL_MIN_SCORE` | 0.25 |

Below `RETRIEVAL_MIN_SCORE`, results are dropped rather than padded. An empty retrieval leading to "I could not find that in this repository" is a better answer than a confident one built from unrelated chunks.

## Chat Limits

| Limit | Variable | Default |
| --- | --- | --- |
| Context chunks | `MAX_CONTEXT_CHUNKS` | 16 |
| Context tokens | `MAX_CONTEXT_TOKENS` | 12000 |
| History messages | `MAX_HISTORY_MESSAGES` | 10 |
| Output tokens | `MAX_OUTPUT_TOKENS` | 2000 |
| Provider timeout | `LLM_REQUEST_TIMEOUT_MS` | 60000 |
| First-token target | `FIRST_TOKEN_TARGET_MS` | 2000 |

## Rate Limits

Per authenticated user unless noted. All 429 responses include `Retry-After`.

| Endpoint group | Variable | Default |
| --- | --- | --- |
| Default API | `RATE_LIMIT_DEFAULT_PER_MINUTE` | 300 |
| Repository import | `RATE_LIMIT_IMPORT_PER_HOUR` | 5 |
| Re-index | `RATE_LIMIT_REINDEX_PER_HOUR` | 3 |
| Chat messages | `RATE_LIMIT_CHAT_PER_HOUR` | 20 |
| Graph queries | `RATE_LIMIT_GRAPH_PER_MINUTE` | 120 |
| Auth refresh | `RATE_LIMIT_REFRESH_PER_MINUTE` | 10 |
| Unauthenticated (per IP) | `RATE_LIMIT_ANON_PER_MINUTE` | 60 |

## Cost Quotas

Enforced before any paid call. Exceeding one returns `402` with the limit and its reset date.

| Quota | Variable | Default |
| --- | --- | --- |
| Embedding tokens per user per month | `QUOTA_EMBEDDING_TOKENS_PER_MONTH` | 2000000 |
| Chat tokens per user per month | `CHAT_QUOTA_TOKENS_PER_MONTH` | 500000 |
| Imports per user per month | `QUOTA_IMPORTS_PER_MONTH` | 30 |

### Why quotas exist at all

A single large repository can cost several dollars to embed, and re-indexing on every push multiplies that. Content-hash embedding reuse removes most of the recurring cost, but nothing removes the first index of a very large repository. Without a hard ceiling checked before the call, one user importing a huge monorepo produces a surprise bill and no signal until it arrives.

Rough sizing at the defaults, using a small embedding model: a 5,000-file TypeScript repository produces roughly 30,000–60,000 chunks, around 15–30 million tokens, in the low single-digit dollars for a first index. The monthly embedding quota is set to allow a handful of such repositories.

## Language Support

| Capability | TypeScript / JavaScript | Everything else |
| --- | --- | --- |
| File inventory | yes | yes |
| Folder tree and folder graph | yes | yes |
| Chunking, embeddings, chat | yes | yes (line-window chunking) |
| Symbol graph | yes | no |
| Dependency graph | yes | no |

Unsupported languages must degrade visibly and specifically: the UI names which graphs are unavailable and why, and everything else keeps working. Silent emptiness reads as a broken product.

## Storage Sizing (rough, per 5,000-file repository)

| Item | Estimate |
| --- | --- |
| Archive | 20–80 MB |
| Extracted per-file text | 30–120 MB |
| `repository_files` + `code_symbols` + `file_dependencies` | 20–60 MB |
| `graph_nodes` + `graph_edges` | 10–40 MB |
| `code_chunks` including vectors | 200–600 MB |

Vectors dominate. At 1536 dimensions a single embedding is about 6 KB; 50,000 chunks is roughly 300 MB before the HNSW index. Plan database storage from chunk count, not repository size.

## Review Cadence

Revisit these numbers when any of the following is true: a real repository is rejected that should have been accepted, a graph is routinely truncated for typical repositories, monthly provider spend exceeds expectations, or p95 indexing time exceeds ten minutes for a typical repository.
