# AI Code Archaeologist

Sign in with GitHub, index a repository, explore its folder, dependency, and symbol graphs, and ask questions about the code — answered with real file and line citations.

## What it does

- **Sign in with GitHub** — the only identity provider; the app cannot work without it anyway.
- **Import a repository** — snapshot by commit SHA, index in the background, watch live progress.
- **Explore graphs** — folder tree, file dependency graph (including external packages), class and function graph, rendered with React Flow.
- **Ask questions** — retrieval-augmented chat grounded in the indexed code, streamed, with clickable `path:line-line` citations that open the file.

## Architecture at a glance

Four deployables:

| Deployable | What it does | Database |
| --- | --- | --- |
| `web` | React SPA | — |
| `api` | Public REST + SSE, identity, GitHub tokens, authorization | `aca_api` |
| `indexer` | Repository identity, snapshots, parsing, graphs, pipeline state | `aca_indexer` |
| `ai` | Chunking, embeddings, retrieval, chat | `aca_ai` (pgvector) |

Background work runs on **pg-boss** in a dedicated `aca_queue` database. Chat is synchronous and streamed — never queued.

Stack: React + Vite + React Flow · NestJS + Fastify · PostgreSQL + pgvector · Redis · S3-compatible storage · pnpm + Turborepo.

## Documentation

New here? [`READING_ORDER.md`](./READING_ORDER.md) walks through all 26 documents in the order they make sense, with shortcuts for "I have 30 minutes" and "I start coding tomorrow".

The set:

| Document | Purpose |
| --- | --- |
| [`READING_ORDER.md`](./READING_ORDER.md) | What to read, in what order, and when |
| [`CODEBASE.md`](./CODEBASE.md) | Architecture, ownership, pipeline, security. **Start here.** |
| [`RULES.md`](./RULES.md) | Engineering rules every module follows |
| [`DEVELOPMENT_STAGES.md`](./DEVELOPMENT_STAGES.md) | Build order with exit criteria |
| [`LOCAL_SETUP.md`](./LOCAL_SETUP.md) | Getting it running |
| [`WORKSPACE_AND_PACKAGE_STRATEGY.md`](./WORKSPACE_AND_PACKAGE_STRATEGY.md) | Monorepo, scripts, CI |
| [`EVENT_CONTRACTS.md`](./EVENT_CONTRACTS.md) | Job envelope and every payload schema |
| [`API_ERROR_CODES.md`](./API_ERROR_CODES.md) | Error envelope and code registry |
| [`SCOPE_LIMITS.md`](./SCOPE_LIMITS.md) | Every limit, quota, and default value |
| [`LLM_PROMPTING.md`](./LLM_PROMPTING.md) | System prompt, grounding, citations, evaluation |
| [`DATA_RETENTION_AND_PRIVACY.md`](./DATA_RETENTION_AND_PRIVACY.md) | What is stored, for how long, and how it is deleted |
| [`adr/`](./adr) | Why the load-bearing decisions were made |

Module plans:

| Deployable | Modules |
| --- | --- |
| `api` | [Gateway](./API_GATEWAY_SERVICE_PLAN.md) · [Auth & GitHub Identity](./AUTH_SERVICE_PLAN.md) |
| `indexer` | [Repositories & Snapshots](./GITHUB_CONNECTOR_SERVICE_PLAN.md) · [Pipeline](./JOB_ORCHESTRATOR_SERVICE_PLAN.md) · [Parser](./REPOSITORY_PROCESSOR_SERVICE_PLAN.md) · [Graph](./GRAPH_SERVICE_PLAN.md) |
| `ai` | [Retrieval](./SEARCH_EMBEDDING_SERVICE_PLAN.md) · [Chat](./CHAT_SERVICE_PLAN.md) |
| `web` | [Web App](./REACT_UI_PLAN.md) |

## Quick start

```bash
pnpm install
cp .env.example .env          # then fill in the GitHub App and LLM keys
pnpm infra:up                 # PostgreSQL, Redis, MinIO
pnpm db:migrate
pnpm dev
```

Web app on http://localhost:5173, API on http://localhost:3000.

You do not need a GitHub App to develop most of the product:

```bash
pnpm seed:sample-repo         # pushes the sample fixture into the pipeline
```

Full instructions, including GitHub App registration, are in [`LOCAL_SETUP.md`](./LOCAL_SETUP.md).

## A few decisions worth knowing up front

- **`repoId` is minted only by `indexer`.** Nothing else may create one.
- **Ownership is checked once, at `api`**, then asserted downstream with a 60-second internal service token. That is why `indexer` and `ai` tables carry no `user_id`.
- **One active snapshot per repository.** Graphs and chat always read `repositories.active_snapshot_id`.
- **Embeddings are keyed by content hash**, so re-indexing an unchanged repository costs nothing.
- **The queue is for background work only.** Anything a user is waiting on is synchronous.
- **Dependency and symbol graphs are TypeScript/JavaScript only in v1.** Everything else still gets file inventory, chunking, and chat.

## Status

Pre-implementation. The documentation set is complete; see [`DEVELOPMENT_STAGES.md`](./DEVELOPMENT_STAGES.md) for what to build first.
