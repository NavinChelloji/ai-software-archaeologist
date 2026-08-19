# ADR 0004 — dbmate for migrations, not a hand-written runner

**Status:** Accepted · **Date:** 2026-08-18

## Context

The project requires raw SQL migrations, one folder per deployable, run as a separate deployment step. That requirement is good and is kept.

The original workspace strategy implemented it with `tsx scripts/run-migrations.ts` in every service. A migration runner that is actually safe has to handle ordering, applied-state tracking, checksum verification so an edited migration is detected, an advisory lock so two instances cannot migrate concurrently, per-migration transactions with correct handling of statements that cannot run inside one (`CREATE INDEX CONCURRENTLY`), and clear failure reporting. That is a few hundred lines of fiddly, high-consequence code — duplicated once per service, and almost certainly written in a simplified form that omits the locking and checksumming.

A broken migration runner fails in the worst possible place: production, mid-deploy, with partially applied schema.

## Decision

Use **dbmate**, with one migrations directory per deployable.

```text
services/api/migrations/
services/indexer/migrations/
services/ai/migrations/
```

```bash
dbmate --url $DATABASE_URL --migrations-dir ./migrations up
```

dbmate matches every requirement already stated: plain `.sql` files, no ORM, no code generation, explicit up/down sections, a `schema_migrations` table, and a single static binary that runs identically in CI, in a migration container, and on a developer machine.

Naming convention `NNN_short_description.sql` is retained, prefixed per module inside a deployable so ownership stays legible:

```text
services/indexer/migrations/
  001_create_repositories.sql          # repositories module
  010_create_processing_jobs.sql       # pipeline module
  020_create_repository_files.sql      # parser module
  030_create_graph_nodes.sql           # graph module
```

Migrations run as their own deployment step, never on application boot in production.

## Consequences

**Positive**

- Zero lines of migration infrastructure to write, test, or debug.
- Concurrency safety, checksum verification, and rollback support are handled by a tool that many projects have already broken in interesting ways.
- The same command works locally, in CI, and in a production migration job.
- CI can verify every migration applies cleanly from an empty database on every pull request, which is the check that catches most migration mistakes.

**Negative**

- One more tool in the toolchain. It is a single binary and a dev dependency; negligible.
- dbmate's `down` migrations are optional and often skipped, which can encourage forward-only habits. Acceptable: for destructive changes, `RULES.md` requires documented migration notes regardless, and forward-only with a documented rollback plan is generally safer than a `down` script nobody has tested.
- Some Postgres statements cannot run inside a transaction. dbmate supports disabling the transaction per migration; this must be used deliberately for `CREATE INDEX CONCURRENTLY` on large tables.

**Reversibility**

High. Migration files are plain SQL with a standard tracking table. Moving to another tool, or to a hand-written runner later, means reading the same files and the same `schema_migrations` table.

## Alternatives considered

**`node-pg-migrate` with SQL-only migrations.** Works, and stays inside the Node toolchain, but its natural style is JavaScript migrations, which invites drift away from the raw-SQL rule.

**Flyway or Liquibase.** Mature and capable, but a JVM dependency in a Node project, and Liquibase's XML/YAML changelog format conflicts directly with the raw-SQL requirement.

**Keep the hand-written runner.** Only defensible if the runner is treated as real infrastructure — locking, checksums, transaction handling, tests. That is a meaningful amount of work to reimplement something that already exists, in a place where bugs are expensive.
