# Data Retention and Privacy

This system stores private source code, derived representations of it (symbols, graphs, embeddings), and conversation transcripts about it. That is a meaningful amount of trust. This document states exactly what is stored, where, for how long, and how it is removed.

## What Is Stored

| Data | Location | Contains source code? |
| --- | --- | --- |
| Repository archive | S3 `{repoId}/{snapshotId}/archive.tar.gz` | yes, complete |
| Per-file text | S3 `{repoId}/{snapshotId}/files/{fileId}` | yes, filtered |
| File inventory | `aca_indexer.repository_files` | no — paths and hashes only |
| Symbols | `aca_indexer.code_symbols` | names, signatures, line ranges |
| Dependencies | `aca_indexer.file_dependencies` | import specifiers |
| Graphs | `aca_indexer.graph_nodes/edges` | labels and paths |
| Chunks | `aca_ai.code_chunks` | yes, verbatim excerpts |
| Embeddings | `aca_ai.code_chunks.embedding` | derived vectors |
| Conversations | `aca_ai.chat_messages` | excerpts the user or assistant quoted |
| GitHub tokens | `aca_api.users`, encrypted | no |
| Logs | log store | **never** source content |

Two rows in that table matter most: `code_chunks.content` and `chat_messages.content` hold verbatim private code, and the S3 archive holds all of it. Everything else is metadata.

## What Is Never Stored

Files matching these patterns are excluded during extraction. They never reach S3, the database, an embedding, or a prompt:

```text
.env, .env.*, *.env
*.pem, *.key, *.p12, *.pfx, *.jks, *.keystore
id_rsa*, id_ed25519*, *.ppk
.npmrc, .netrc, .pgpass, .htpasswd
credentials, credentials.json, service-account*.json
*.tfstate, *.tfstate.backup
secrets.*, *secrets.yaml, *secrets.yml
```

Files that survive the filter are still scanned for secret content (high-entropy strings, `AKIA`-prefixed keys, PEM blocks, bearer tokens, connection strings). Matches are replaced with `[REDACTED_SECRET]` before storage, embedding, and prompt assembly.

This is a best-effort defence, not a guarantee. It is stated as such to users rather than overclaimed.

## What Is Never Logged

- Access tokens, refresh tokens, OAuth codes, GitHub tokens.
- Source file content, chunk content, or message content.
- Full request or response bodies for chat and retrieval endpoints.

Logs carry paths, counts, IDs, durations, and error codes. If a log line would help someone reconstruct private code, it does not belong in a log.

## Retention

| Data | Retention | Mechanism |
| --- | --- | --- |
| Snapshot archives and file text | Active snapshot plus `SNAPSHOT_RETENTION_COUNT - 1` older | `snapshot.prune` job + S3 lifecycle |
| Superseded graphs, symbols, files | Deleted with their snapshot | `snapshot.prune` |
| Chunks and embeddings | While any retained snapshot references them | `snapshot_chunks` link table |
| Conversations and messages | Until the user deletes them or the repository | User action |
| Job records and stage events | `JOB_EVENT_RETENTION_DAYS` (30) | Scheduled cleanup |
| Token usage records | 13 months | Needed for monthly quota windows |
| Application logs | 30 days | Log store policy |
| Refresh sessions | Until expiry or revocation, then 7 days | Scheduled cleanup |

Chunks are keyed on `(repo_id, content_hash)` and referenced by `snapshot_chunks`, so pruning a snapshot deletes only the chunks no remaining snapshot still references.

## Deletion

### Repository deletion — `DELETE /api/v1/repositories/:repoId`

Publishes `repo.deleted`. Handlers run in this order:

1. `indexer` marks `repositories.deleted_at` and clears `active_snapshot_id`, so the repository disappears from the UI immediately.
2. `indexer` deletes graph edges and nodes, dependencies, symbols, files, snapshots.
3. `ai` deletes `snapshot_chunks`, orphaned `code_chunks`, conversations, and messages for the repository.
4. `indexer` deletes the S3 prefix `{repoId}/`.
5. `indexer` deletes the repository row.

Steps 2–4 are idempotent and retried on failure. Deletion is complete within `DELETION_SLA_MINUTES` (60) and verified by a reconciliation job that looks for orphaned S3 prefixes and chunk rows.

### Account deletion

Publishes `user.deleted` with the user's repository IDs. Every repository goes through the path above, then:

- all refresh sessions are revoked and deleted;
- the encrypted GitHub tokens are deleted;
- the `users` row is deleted;
- `token_usage` rows are anonymized rather than deleted (the `user_id` is replaced with a tombstone) so aggregate billing history survives without identifying the user.

### Disconnecting GitHub

Deletes the stored GitHub tokens and marks `disconnected_at`. Already-indexed repositories remain readable — the code is already stored — but no new import or re-index is possible until reconnection. The UI must say this plainly, because "disconnect" reasonably sounds like "delete my data" to a user. Offer both actions side by side.

## Third-Party Processing

Code excerpts leave the system in exactly two places:

1. **Embedding provider** — chunk text is sent to generate vectors, during indexing.
2. **LLM provider** — retrieved chunks are sent as context, during chat.

Both must be disclosed before a user imports their first private repository. Requirements:

- Use provider configurations that exclude the data from model training.
- Record the provider and model on every `token_usage` row so processing history is auditable.
- If a self-hosted embedding model is later added, make it selectable per user, because some users cannot send code off-premises at all.

## Access Control Summary

- A user can read only their own repositories, verified at `api` and asserted downstream by the internal service token.
- Internal endpoints are unreachable from the public ingress.
- Database credentials are per-deployable; no deployable can read another's tables.
- GitHub tokens exist only in `aca_api`, encrypted, and are handed to `indexer` per job in memory only.

## User-Facing Statements

These should appear in the product, in this language:

- "We store a copy of your repository at the commit you indexed, so we can answer questions about it."
- "We skip files that commonly contain secrets, and we redact things that look like credentials. This is best-effort — do not rely on it as your only protection."
- "Your code is sent to our embedding and language model providers to build the index and answer your questions."
- "Deleting a repository removes its code, index, and conversations within an hour."

## Incident Handling

If source content or a token is exposed:

1. Revoke affected GitHub tokens immediately (`disconnected_at`, delete encrypted values).
2. Rotate `TOKEN_ENCRYPTION_KEY` to a new version and re-wrap remaining rows.
3. Rotate `INTERNAL_JWT_SECRET` and JWT signing keys, invalidating all sessions.
4. Identify affected users from `token_usage` and audit logs.
5. Notify affected users with what was exposed and when.

## Open Decisions

- Whether to offer "index metadata only" mode (symbols and graphs, no chunk storage, no chat) for users who cannot store code excerpts.
- Whether conversation retention should be user-configurable.
- Whether to support a self-hosted embedding model.

These are recorded here rather than left implicit, because each is much cheaper to build before the schema is full of data.
