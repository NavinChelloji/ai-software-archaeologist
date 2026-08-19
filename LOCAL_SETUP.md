# Local Setup

## Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 20.11+ | 22 also fine |
| pnpm | 9.12+ | `corepack enable && corepack prepare pnpm@9.12.0 --activate` |
| Docker | 24+ | with Compose v2 |
| dbmate | 2.19+ | installed as a dev dependency, no global install needed |

Roughly 8 GB of RAM and 20 GB of free disk if you plan to index a real repository.

## 1. Install

```bash
git clone <repo-url> ai-code-archaeologist
cd ai-code-archaeologist
pnpm install
cp .env.example .env
```

## 2. Start infrastructure

```bash
pnpm infra:up
```

This starts PostgreSQL (5432), Redis (6379), and MinIO (9000, console 9001), then creates the four databases:

```text
aca_api      aca_indexer      aca_ai      aca_queue
```

MinIO console: http://localhost:9001 — credentials from `.env`. The `aca-snapshots` bucket is created by the init script.

## 3. Migrate

```bash
pnpm db:migrate
```

Runs dbmate for `api`, `indexer`, and `ai`. pg-boss creates its own schema in `aca_queue` on first run.

Verify pgvector:

```bash
docker compose exec postgres psql -U postgres -d aca_ai -c "SELECT extversion FROM pg_extension WHERE extname='vector';"
```

## 4. Run

```bash
pnpm dev
```

| Service | URL |
| --- | --- |
| Web | http://localhost:5173 |
| API | http://localhost:3000 |
| API docs | http://localhost:3000/docs |
| Indexer | http://localhost:3100 |
| AI | http://localhost:3200 |

Check readiness:

```bash
curl -s localhost:3000/health/ready | jq
curl -s localhost:3100/health/ready | jq
curl -s localhost:3200/health/ready | jq
```

## 5. Develop without GitHub

Registering a GitHub App is only needed for the real sign-in and import flow. Everything from indexing onward can be developed and tested against the checked-in fixture:

```bash
pnpm seed:sample-repo
```

This uploads `fixtures/sample-repo.tar.gz` to MinIO, creates a repository and snapshot row, and enqueues `repo.snapshot.created` — entering the pipeline at stage two. A dev-only session cookie is issued so the web app can view the result.

The fixture has known files, symbols, and imports, including deliberate edge cases: an unresolvable import, a `tsconfig` path alias, an index-directory import, a generated file, an oversized file, a binary file, a `.env` that must be excluded, and a prompt-injection string that must be ignored.

Seeding is available only when `NODE_ENV=development` and `ENABLE_DEV_SEED=true`.

## 6. GitHub App (for the real flow)

1. GitHub → Settings → Developer settings → **GitHub Apps** → New GitHub App.
2. Homepage `http://localhost:5173`, callback `http://localhost:3000/api/v1/auth/github/callback`.
3. Enable **Request user authorization (OAuth) during installation** and **Expire user authorization tokens**.
4. Permissions: `Repository → Contents: Read-only`, `Repository → Metadata: Read-only`. Nothing else.
5. No webhooks needed for v1.
6. Generate a client secret.
7. Install the App on your account and select the repositories you want to index.

Then fill in:

```dotenv
GITHUB_APP_CLIENT_ID=Iv1....
GITHUB_APP_CLIENT_SECRET=....
GITHUB_CALLBACK_URL=http://localhost:3000/api/v1/auth/github/callback
```

A GitHub App is used rather than a classic OAuth App for per-repository grants, higher rate limits, and short-lived tokens — see `adr/0002-github-only-auth.md`.

## 7. Keys and secrets

Generate the local development keys:

```bash
# JWT signing keypair
openssl genpkey -algorithm RSA -out jwt-private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -pubout -in jwt-private.pem -out jwt-public.pem

# Internal service token secret and token encryption key
openssl rand -base64 48   # -> INTERNAL_JWT_SECRET
openssl rand -base64 32   # -> TOKEN_ENCRYPTION_KEY_V1
```

Paste the PEM contents into `.env` with `\n` escapes, or point at file paths if your config loader supports it. **Do not commit these.** `.env` and `*.pem` are gitignored; verify before your first commit.

## 8. LLM provider

```dotenv
LLM_PROVIDER=openai
LLM_API_KEY=sk-...
CHAT_MODEL=...
EMBEDDING_MODEL=text-embedding-3-small
```

Indexing a real repository costs real money — see the sizing table in `SCOPE_LIMITS.md`. Start with the sample fixture. Quotas are enforced before any paid call, so a misconfiguration cannot run away.

## Common commands

```bash
pnpm dev                       # everything
pnpm dev:web                   # one service
pnpm --filter @aca/indexer dev

pnpm test                      # unit + integration
pnpm test:e2e                  # end-to-end against the fixture
pnpm lint && pnpm typecheck

pnpm db:new create_something   # new migration
pnpm db:migrate:indexer        # migrate one database
pnpm infra:reset               # wipe volumes and start clean
```

## Troubleshooting

**`pnpm dev` fails with missing types from `@aca/contracts`**
`packages/contracts` must build first. Run `pnpm build --filter @aca/contracts`, or just `pnpm build` once.

**`/health/ready` returns 503**
Check which dependency it names. Usually infrastructure has not finished starting — `docker compose ps` and retry. If MinIO is healthy but the bucket is missing, re-run `pnpm infra:up`.

**`extension "vector" is not available`**
The Postgres image must include pgvector (`pgvector/pgvector:pg16` in `docker-compose.yml`), not the stock `postgres` image.

**Jobs enqueue but nothing runs**
Confirm `QUEUE_DATABASE_URL` points at `aca_queue` in *every* service, and that at least one worker process is running (`--role=worker`, or `pnpm dev` which runs both roles).

**Indexing stalls at a stage**
Look at `job_stage_events` for the last recorded stage, and check the indexer logs for that `correlationId`. A stage with no terminal event is usually a worker that died mid-batch; the stalled-job sweeper should fail it within a minute.

**Progress bar stops updating**
The SSE connection dropped, or Redis Pub/Sub is not reachable. The web app falls back to polling after two failed reconnects; if it did not, check `REDIS_URL` in both `api` and `indexer`.

**Chat answers have no citations**
Either retrieval returned nothing above `RETRIEVAL_MIN_SCORE` (a legitimate answer), or citation validation stripped them. Check the indexer logs for `citation_validation_failed`.

**Everything is broken and you want a clean slate**

```bash
pnpm infra:reset && pnpm seed:sample-repo
```
