# Workspace and Root Package Strategy

## Goal

Run everything from one root `package.json` during local development, while keeping each of the four deployables independently buildable and deployable as its own image.

## Package Manager

`pnpm` workspaces, with `turbo` for task orchestration and caching.

## Root Workspace Files

```text
package.json
pnpm-workspace.yaml
turbo.json
docker-compose.yml
.env.example
.github/workflows/ci.yml
```

## `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "services/*"
  - "packages/*"
```

## Root `package.json`

```json
{
  "name": "ai-code-archaeologist",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=20.11" },
  "scripts": {
    "dev": "turbo run dev --parallel",
    "dev:web": "pnpm --filter @aca/web dev",
    "dev:api": "pnpm --filter @aca/api dev",
    "dev:indexer": "pnpm --filter @aca/indexer dev",
    "dev:ai": "pnpm --filter @aca/ai dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "test:e2e": "turbo run test:e2e",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "format": "prettier --write .",
    "infra:up": "docker compose up -d postgres redis minio && pnpm infra:init",
    "infra:init": "docker compose exec -T postgres psql -U postgres -f /docker-entrypoint-initdb.d/create-databases.sql",
    "infra:down": "docker compose down",
    "infra:reset": "docker compose down -v && pnpm infra:up && pnpm db:migrate",
    "db:migrate": "turbo run db:migrate",
    "db:migrate:api": "pnpm --filter @aca/api db:migrate",
    "db:migrate:indexer": "pnpm --filter @aca/indexer db:migrate",
    "db:migrate:ai": "pnpm --filter @aca/ai db:migrate",
    "db:new": "dbmate new",
    "seed:sample-repo": "pnpm --filter @aca/indexer seed:sample-repo"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.5.0",
    "prettier": "^3.3.0",
    "dbmate": "^2.19.0"
  }
}
```

`turbo.json` declares `build` depends on `^build`, `typecheck` depends on `^build`, and `dev` is persistent and uncached. `packages/contracts` must build before any service typechecks.

## Databases

Four PostgreSQL databases on one server locally:

| Database | Owner | Contents |
| --- | --- | --- |
| `aca_api` | `api` | users, refresh sessions, GitHub identities, processed_events |
| `aca_indexer` | `indexer` | repositories, snapshots, files, symbols, dependencies, graphs, jobs, processed_events |
| `aca_ai` | `ai` | chunks, embeddings (pgvector), conversations, messages, usage, processed_events |
| `aca_queue` | shared infrastructure | pg-boss schema only |

`aca_queue` is infrastructure, exactly as Kafka would have been. It holds no domain data, and the no-cross-database-writes rule applies only to the three domain databases.

Locally these can be schemas in one database if you prefer fewer connections. In production keep them separate so a deployable can be moved to its own instance without a data migration.

## Service Package Convention

```json
{
  "name": "@aca/indexer",
  "private": true,
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start": "node dist/main.js",
    "start:worker": "node dist/main.js --role=worker",
    "test": "vitest run",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "db:migrate": "dbmate --env-file ../../.env --url $DATABASE_URL --migrations-dir ./migrations up"
  }
}
```

`--role` lets one image run as an HTTP instance or a queue worker. Same build, different startup command, different scaling policy.

## Independent Deployment Rule

Each deployable must:

- Have its own Dockerfile and `.env.example`.
- Have its own `migrations` folder and migration command.
- Own its database connection string.
- Build from its own source plus allowed shared packages only.
- Expose its own health endpoints.
- Start without any other application service running (it may be `not ready` until dependencies appear).

## Local Development Commands

```bash
pnpm install
pnpm infra:up
pnpm db:migrate
pnpm dev
```

Run one thing:

```bash
pnpm dev:web
pnpm dev:api
pnpm --filter @aca/indexer dev
```

Seed the sample repository without touching GitHub:

```bash
pnpm seed:sample-repo
```

Build one image:

```bash
docker build -f services/indexer/Dockerfile -t aca/indexer:local .
```

The Dockerfile builds from the repository root so workspace packages resolve. Use `pnpm deploy --filter` or `turbo prune --scope` to produce a minimal build context per service.

## Docker Compose Strategy

- `docker-compose.yml` defines PostgreSQL, Redis, and MinIO under an `infra` profile.
- An optional `apps` profile runs the three services and the web build as containers.
- Explicit environment variables per service; no shared writable source volumes in the `apps` profile.
- For day-to-day development, run infrastructure in Docker and services on the host — faster reloads and easier debugging.

## CI Strategy

1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm test` (unit + integration with Testcontainers)
5. `pnpm build`
6. `pnpm test:e2e` against the sample repository fixture
7. Build each service image, tagged with the commit SHA
8. Scan dependencies and images
9. Run migrations against throwaway databases to verify they apply cleanly from empty

Turbo's remote cache is worth enabling once the pipeline exceeds a few minutes.

## Why not a package per module

The eight original service boundaries survive as **modules** inside three backend deployables (see `adr/0001-four-deployables.md`). They are not separate workspace packages, because a workspace package boundary adds build ordering, versioning, and `package.json` maintenance without preventing the coupling that actually matters. Module boundaries are enforced by rules and lint (`no-restricted-imports` on cross-module deep paths), which is cheaper and equally effective at this size.
