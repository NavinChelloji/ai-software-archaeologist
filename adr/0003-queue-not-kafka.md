# ADR 0003 — pg-boss for background work, not Kafka

**Status:** Accepted · **Date:** 2026-08-18

## Context

The original design used Kafka as the backbone for repository processing, with thirteen topics, a versioned event envelope, dead-letter topics, and idempotent consumers.

Kafka earns its operational cost when you need durable replay, fan-out to many independent consumer groups, high sustained throughput, or decoupled team ownership across services.

The workload here has none of those properties:

- The pipeline is a **linear sequence with one consumer per stage**: snapshot → parse → graph → embed → done.
- Throughput is a handful of repository imports per user per week, not thousands of messages per second.
- Replay is not meaningful — re-running a stage means re-reading the snapshot from S3, which is an explicit re-index, not an offset rewind.
- One team owns everything.

Against that, Kafka adds: a broker plus coordination to run locally and in production, consumer group and partition rebalancing to reason about, offset management, a separate schema registry concern, and — as noted in the Gateway plan — a genuine correctness trap where progress events delivered to one replica in a consumer group never reach the replica holding the user's connection.

The system already runs PostgreSQL and needs it to be reliable regardless.

## Decision

Use **pg-boss** on a dedicated `aca_queue` PostgreSQL database for all background work, behind the job contracts in `packages/contracts`.

Everything about the original contract design is kept:

- the same lowercase dot-separated job names;
- the same envelope (`eventId`, `eventType`, `version`, `occurredAt`, `correlationId`, `causationId`, `retryCount`, `payload`);
- the same idempotency requirement, via a `processed_events` table in each database;
- the same dead-letter convention (`<job>.dlq`);
- the same rule that large artifacts go to object storage and only keys travel in payloads.

`aca_queue` is treated as infrastructure, exactly as Kafka would have been. It holds no domain data, and the "no service writes another service's database" rule applies to the three domain databases only.

Live progress to the browser goes over **Redis Pub/Sub**, not the queue — see the Gateway plan for why consuming progress from a queue in a horizontally scaled Gateway silently breaks.

## Consequences

**Positive**

- No broker to run, tune, or upgrade. Local development is `docker compose up postgres redis minio`.
- Job state and domain state can be committed in the same transaction where useful, removing a class of dual-write bugs.
- Jobs are inspectable with SQL. Debugging a stuck pipeline is a query, not a CLI incantation.
- Retries, backoff, scheduling, singleton jobs, and dead-lettering are built in.
- Deletes an entire operational competency from the critical path to a working product.

**Negative**

- Throughput ceiling is far lower than Kafka's — realistically thousands of jobs per minute rather than hundreds of thousands. Orders of magnitude above what this workload needs.
- No log replay or time-travel. Not needed: re-indexing is the equivalent operation and is explicit.
- Queue load and domain load share a database server. Mitigated by a separate database now, and a separate instance later if needed.
- Fan-out to multiple independent consumers of one job requires enqueueing per consumer rather than being free. There are currently no such cases, and `EVENT_CONTRACTS.md` names the consumer for every job.

**Reversibility**

High, by design. Producers and consumers only see `packages/queue`, which exposes `publish(jobName, payload)` and `subscribe(jobName, handler)`. Swapping in Kafka means implementing that interface against a Kafka client; job names, envelope, payload schemas, idempotency, and DLQ semantics all carry over unchanged.

The trigger to reconsider: sustained job rates that make Postgres queue polling a bottleneck, a second independent consumer for the same event, or a requirement for event replay.

## Alternatives considered

**BullMQ on Redis.** Excellent ergonomics and faster, but job durability then depends on Redis persistence configuration, and jobs cannot participate in a domain transaction. Since Redis is already in the stack for cache and pub/sub, keeping it stateless-by-assumption is the safer default.

**Postgres `LISTEN/NOTIFY` with a hand-rolled queue.** Fewer dependencies, but retries, backoff, visibility timeouts, scheduling, and dead-lettering all have to be written and tested — which is precisely the plumbing this decision exists to avoid.

**Keep Kafka.** Correct if the goal is to demonstrate a Kafka-based architecture, or if a second consumer group is genuinely coming. Neither applies.
