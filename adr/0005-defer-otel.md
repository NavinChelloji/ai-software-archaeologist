# ADR 0005 — Defer OpenTelemetry; ship correlation IDs and metrics first

**Status:** Accepted · **Date:** 2026-08-18

## Context

The original specification required OpenTelemetry traces across HTTP and broker boundaries in every service, alongside Prometheus metrics and structured logs, as part of the pre-MVP observability stage.

Distributed tracing across asynchronous boundaries is not free. Context propagation through queue payloads, correct span linking between a producer and a consumer that runs minutes later, sampling policy, a collector to run, and a backend to store and query traces — each is a real piece of work, and the async parts are where tracing implementations most often end up subtly wrong (orphaned spans, broken parent links, traces that stop at the queue).

Meanwhile, the debugging questions this system will actually pose in its first months are:

- "Why did this repository's indexing fail?"
- "Which stage was slow?"
- "Why did this chat answer have no citations?"
- "Is the queue backing up?"

All four are answered by structured logs with a correlation ID, the `job_stage_events` timeline, and stage-duration metrics. None of them requires span-level tracing.

## Decision

For v1, ship:

- **Structured JSON logs** including `service`, `module`, `requestId`, `correlationId`, and where available `userId`, `repoId`, `snapshotId`, `jobId`, `conversationId`.
- **`correlationId` and `causationId` propagated across every HTTP and queue boundary**, from day one, in the standard envelope.
- **Prometheus metrics**: HTTP latency and error rate, queue depth and job age per job name, stage duration, embedding duration and token count, chat latency and first-token latency, provider error rate.
- **Per-stage timings** persisted in `job_stage_events`, giving a durable timeline per indexing run without any tracing backend.

Defer OpenTelemetry tracing to post-MVP.

The critical part of this decision is the propagation requirement. Because `correlationId` and `causationId` already flow through every request and every job envelope, adding OTel later is instrumentation over an existing correlation model — not a retrofit that requires changing every payload and every handler signature.

## Consequences

**Positive**

- Roughly 80% of the debugging value for a small fraction of the effort.
- No collector, no trace backend, no sampling policy to operate before there is a product.
- `job_stage_events` gives a durable, queryable per-run timeline — arguably better than traces for the specific question "what happened during this indexing run", because it survives sampling and retention limits.
- Metrics and logs are enough to build the dashboards and alerts that matter: queue depth, DLQ arrivals, stage failure rate, provider errors.

**Negative**

- No span-level flame graph for a single slow request. Mitigated by stage timings and latency metrics, which localize slowness to a stage.
- Cross-service latency attribution is coarser. With three backend deployables and mostly in-process module calls, there is much less cross-service latency to attribute than the original eight-service design would have had.
- If a subtle cross-boundary performance problem appears, adding tracing becomes urgent rather than planned. Accepted, and cheap because propagation already exists.

**Reversibility**

High. Adding OTel means installing the SDK, enabling auto-instrumentation for HTTP and PostgreSQL, and using the existing `correlationId` as the trace correlation key while extracting a real trace context from the job envelope. No payload schema changes, no handler signature changes.

**Trigger to revisit:** more than three backend deployables, a persistent latency problem that stage timings cannot localize, or the first on-call rotation.

## Alternatives considered

**Full OTel in v1 as originally specified.** Correct in a mature organization with an existing collector and backend. Here it is infrastructure work that competes directly with parsing, import resolution, and retrieval quality — the things that determine whether the product is any good.

**Traces without metrics.** Rejected. Metrics answer "is something wrong right now" far better than traces, and alerting on traces is awkward.

**A vendor APM agent instead of OTel.** Faster to switch on, but couples the codebase to a vendor before there is any operational experience to justify the choice.
