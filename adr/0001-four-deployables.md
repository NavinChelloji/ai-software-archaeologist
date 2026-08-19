# ADR 0001 — Four deployables instead of eight microservices

**Status:** Accepted · **Date:** 2026-08-18

## Context

The original design specified eight independently deployable services: API Gateway, Auth, GitHub Connector, Job Orchestrator, Repository Processor, Graph, Search/Embedding, and Chat — each with its own database, Dockerfile, migrations, health checks, environment configuration, and internal API surface.

The architecture is textbook-correct. The problem is the ratio of plumbing to product. Each additional service requires: a Dockerfile, an `.env.example`, a migration folder and runner, a database and connection pool, health checks, an internal auth guard, an idempotency table, queue wiring, a typed HTTP client in the Gateway, tracing setup, and integration test scaffolding. Multiplied by eight, roughly 70% of the total build effort goes to that multiplier rather than to parsing, import resolution, graph construction, retrieval, and prompting — the parts that make the product worth using.

The pipeline the services implement is a **linear sequence with one consumer per stage**:

```text
snapshot -> parse -> graph -> embed -> done
```

Fan-out to many independent consumers, independent team ownership, and independent scaling — the conditions that make eight services pay for themselves — are all absent.

## Decision

Ship four deployables. Keep all eight module boundaries.

| Deployable | Modules |
| --- | --- |
| `web` | React SPA |
| `api` | gateway, auth, github-identity |
| `indexer` | repositories, snapshots, parser, graph, pipeline |
| `ai` | chunking, embeddings, retrieval, chat |

Grouping rationale:

- `api` is the only publicly reachable process and the only holder of credentials. Auth and gateway are one trust domain; splitting them adds a network hop to every authenticated request for no isolation benefit.
- `indexer` modules share the snapshot lifecycle and always deploy together — a change to the parser's output shape requires a matching change in the graph builder. They are CPU-heavy and scale on the same signal (queue depth).
- `ai` modules are IO-heavy, share the LLM provider adapter and token accounting, and are limited by the same provider rate limits.

Module boundaries stay strict and enforced: a module may only be reached through its public service class, may only write its own tables, and must be extractable by moving its folder and swapping in-process calls for HTTP calls. `no-restricted-imports` lint rules enforce the first part.

## Consequences

**Positive**

- Three databases instead of eight; three Dockerfiles, three deployment pipelines, three sets of health checks.
- Cross-service authorization shrinks from an eight-way problem to three-way, making the internal service token design tractable.
- Most cross-service calls become in-process function calls: faster, easier to debug, no serialization boundary, no partial-failure mode.
- Local development runs four processes, not nine plus Kafka.

**Negative**

- Scaling is coarser. The parser and the graph builder scale together even if only one is hot. Acceptable: both scale on queue depth, and the `--role` flag already allows running an image as HTTP or worker with different replica counts.
- A parser deployment restarts the graph builder. Acceptable at this scale with graceful shutdown and job redelivery.
- Discipline is now required where the network used to enforce it. Mitigated by lint rules, the module boundary rules in `RULES.md`, and the extractability requirement.

**Reversibility**

High, and deliberately so. Because module boundaries and job contracts are unchanged, extracting a module later means moving its folder, adding a Dockerfile and database, and replacing in-process service calls with HTTP clients. The queue contracts already treat every stage as if it crossed a process boundary.

## Alternatives considered

**Keep eight services.** Correct if the architecture is itself the deliverable — a distributed-systems portfolio project. Rejected here because the stated goal is a working product, and the plumbing cost delays every user-visible feature.

**One monolith.** Simplest to build, but the parser's CPU profile and the AI service's provider rate limits genuinely differ, and running them in one process means a large repository index starves chat requests. Three backend processes is the smallest split that respects the real resource differences.

**Two services (api + worker).** Tempting, but merging retrieval and chat into the parser process couples LLM provider outages to indexing throughput, and makes the token-accounting boundary unclear.
