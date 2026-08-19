# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository status

Stage 1 (`DEVELOPMENT_STAGES.md`) is implemented: the monorepo skeleton, shared packages, Docker Compose infra, and NestJS/Vite skeletons for all four deployables exist and build/lint/typecheck/test clean. Stages 2+ (auth, indexing pipeline, graphs, chat) are not yet built. Everything in the docs below is a spec that code must conform to — treat every rule as binding, not aspirational.

**Naming note:** the 26 architecture documents (this one included) use `web`/`api`/`indexer`/`ai` as the conceptual deployable names throughout — tables, ADRs, module plans, env var names (`API_DATABASE_URL`...), database names (`aca_api`...), ports, and log `service` fields. The actual folders/packages were later renamed for product branding; the mapping is:

| Doc name | Folder | Package |
| --- | --- | --- |
| `web` | `apps/ai-archaeologist-frontend` | `@aca/ai-archaeologist-frontend` |
| `api` | `services/ai-archaeologist-auth` | `@aca/ai-archaeologist-auth` |
| `indexer` | `services/ai-archaeologist-repository` | `@aca/ai-archaeologist-repository` |
| `ai` | `services/ai-archaeologist-intelligence` | `@aca/ai-archaeologist-intelligence` |

Everything else — database names, env vars, ports, root `package.json` script *names* (`dev:api`, `db:migrate:indexer`, etc.), docker-compose service keys, and internal logger `service:` labels — still uses the doc vocabulary (`api`/`indexer`/`ai`/`web`) and is unaffected by the folder rename.

Start with [`README.md`](./README.md) for the product pitch, then [`READING_ORDER.md`](./READING_ORDER.md), which sequences all 26 documents (with shortcuts for a 30-minute skim vs. "I start coding tomorrow"). [`CODEBASE.md`](./CODEBASE.md) is the architecture source of truth; [`RULES.md`](./RULES.md) is the engineering rulebook every module must follow; [`DEVELOPMENT_STAGES.md`](./DEVELOPMENT_STAGES.md) defines the only valid build order, with exit criteria per stage. The `adr/` directory holds the reasoning behind the load-bearing decisions (four deployables, GitHub-only auth, pg-boss over Kafka, dbmate, deferred OpenTelemetry) — read the relevant ADR before questioning one of these choices.

## Product

Sign in with GitHub, import a repository, watch it get indexed in the background, explore its folder/dependency/symbol graphs, and ask it questions through a chat that cites real files and line ranges.

## Architecture at a glance

Four independently deployable units, each with its own database and its own migrations folder — no deployable ever reads or writes another's tables:

| Deployable | Package | Port (dev) | Database | Owns |
| --- | --- | --- | --- | --- |
| `web` | `@aca/ai-archaeologist-frontend` | 5173 | — | React SPA, no durable data |
| `api` | `@aca/ai-archaeologist-auth` | 3000 | `aca_api` | Users, sessions, GitHub identities/tokens, public REST + SSE, authorization |
| `indexer` | `@aca/ai-archaeologist-repository` | 3100 | `aca_indexer` | `repoId` (canonical), snapshots, file inventory, symbols, dependencies, graphs, pipeline state |
| `ai` | `@aca/ai-archaeologist-intelligence` | 3200 | `aca_ai` (pgvector) | Chunks, embeddings, retrieval, conversations, chat |

`api` is the only process reachable from the internet and the only holder of GitHub tokens. `indexer` and `ai` are reached only via internal HTTP or pg-boss jobs on a shared `aca_queue` database — never a direct DB connection across deployables. Chat is synchronous/streamed and never goes through the queue; the queue is for background work only.

Inside `api`, `indexer`, and `ai`, code is further split into **modules** (e.g. `indexer` = repositories, snapshots, parser, graph, pipeline). Module boundaries are enforced by convention, not the network — see "Module boundaries" below.

### Non-obvious invariants

These are stated explicitly in `CODEBASE.md` because getting them wrong is the most likely source of real bugs:

- **`repoId` is minted only by `indexer`** (`indexer.repositories.id`). `api` never persists GitHub repo listings; it lists them live from GitHub. Nothing else may generate a repo ID.
- **Ownership is resolved once, at `api`**, then asserted downstream via a short-lived (60s) internal service JWT (`iss: api`, `aud: indexer|ai`, `repoId` claim). This is why `indexer` and `ai` tables carry no `user_id` — don't add one to "fix" that.
- **One active snapshot per repository** (`repositories.active_snapshot_id`). All graph/chunk/chat reads filter by the active snapshot; cutover is a single atomic transaction at `repo.processing.completed`.
- **Embeddings are keyed by `(repo_id, content_hash)`** — re-indexing an unchanged repo makes zero new embedding calls.
- **Dependency and symbol graphs are TypeScript/JavaScript only in v1.** Other languages still get file inventory, folder graph, chunking, and chat (line-window fallback) — the UI must say plainly when a graph isn't available, never fail silently.
- **Every pipeline stage is a pg-boss job that emits exactly one terminal event**; the pipeline advances only on that terminal event. Workers emit `repo.stage.failed`; only the pipeline module emits the terminal `repo.processing.failed`.

## Module boundaries

Several modules share one deployable, so boundaries are convention, not network isolation — they still hold:

- A module is reached only through its public `<module>.service.ts` or its queue handlers. Never import another module's repository, entity, or internal helper directly.
- A module reads/writes only its own tables. Cross-module data goes through the owning module's service; cross-*deployable* data goes through internal HTTP or a queue job.
- A module must be extractable into its own deployable by moving its folder and swapping in-process calls for HTTP. If that's hard, the boundary is already broken.
- Shared code lives in `packages/*` and must stay technical (logging, config, queue helpers, DB helpers) — never business logic. Don't create a shared package until at least two real consumers exist.

Full rules (logging, error handling, DB, queue, API, security, testing, etc.) are in [`RULES.md`](./RULES.md) — read it before writing any service code, not just once at the start.

## Commands

These work today (see [`WORKSPACE_AND_PACKAGE_STRATEGY.md`](./WORKSPACE_AND_PACKAGE_STRATEGY.md) and [`LOCAL_SETUP.md`](./LOCAL_SETUP.md) for the fuller narrative):

```bash
pnpm install
pnpm infra:up && pnpm db:migrate     # PostgreSQL (pgvector), Redis, MinIO; creates aca_api/aca_indexer/aca_ai/aca_queue
pnpm dev                             # all four deployables via turbo, --parallel
pnpm dev:web / dev:api / dev:indexer / dev:ai   # run one deployable — the script name still matches the doc's deployable name
pnpm --filter @aca/ai-archaeologist-repository dev   # equivalent, explicit filter form (uses the real package name)

pnpm lint && pnpm typecheck
pnpm test                            # unit + integration (Testcontainers)
pnpm test:e2e                        # against the checked-in sample repo fixture
pnpm build

pnpm db:new <name>                   # new dbmate migration
pnpm db:migrate:api / :indexer / :ai # migrate one database
pnpm infra:reset                     # wipe volumes, reprovision, remigrate

pnpm seed:sample-repo                # pushes fixtures/sample-repo.tar.gz into the pipeline at repo.snapshot.created, no GitHub needed
```

A single Dockerfile per deployable builds from the repo root (workspace packages must resolve); the same image runs as an HTTP instance or a pg-boss worker via `--role=worker`.

## Development order

Stages are sequential and each has explicit exit criteria in [`DEVELOPMENT_STAGES.md`](./DEVELOPMENT_STAGES.md) — do not start a stage without working code, migrations, tests, and a usable UI path (where applicable) for the previous one. From Stage 4 onward, every stage must be exercisable against the checked-in sample repository fixture (entering the pipeline at `repo.snapshot.created`) — never build a stage against live GitHub, so OAuth setup never blocks pipeline work.

## Working conventions worth internalizing before writing code

- Raw SQL migrations only, applied by dbmate, named `NNN_short_description.sql`, one `migrations/` folder per deployable.
- Every job payload is validated against a Zod schema in `packages/contracts` on enqueue *and* on receipt; consumers are idempotent via a `processed_events(event_id, consumer)` table in each deployable's own database.
- TypeScript strict mode; explicit return types on exported functions; avoid `any` without a stated reason.
- Never log tokens, OAuth codes, private source content, or chunk text. Never send `.env*`/key/cert/secret-matching files to extraction, chunking, embedding, or the LLM.
- Chat answers must cite real `path:line-line` ranges from retrieved context; when evidence is missing, say so explicitly rather than inventing a file or symbol.
