import { describe, expect, it } from "vitest";
import { createHttpMetrics } from "./http-metrics";
import { createProviderMetrics } from "./provider-metrics";
import { createQueueMetrics } from "./queue-metrics";
import { createMetricsRegistry } from "./registry";
import { createStageMetrics } from "./stage-metrics";

describe("createMetricsRegistry", () => {
  it("labels every metric with the given service name", async () => {
    const registry = createMetricsRegistry("indexer");
    const { requestDuration } = createHttpMetrics(registry);
    requestDuration.observe({ method: "GET", route: "/health/live", status_code: "200" }, 0.05);

    const text = await registry.metrics();
    expect(text).toContain('service="indexer"');
    expect(text).toContain("http_request_duration_seconds");
  });

  it("gives each registry its own metric instances, not a shared global one", async () => {
    const registryA = createMetricsRegistry("api");
    const registryB = createMetricsRegistry("ai");
    const { requestsTotal: totalA } = createHttpMetrics(registryA);
    createHttpMetrics(registryB);

    totalA.inc({ method: "GET", route: "/health/live", status_code: "200" });

    const textA = await registryA.metrics();
    const textB = await registryB.metrics();
    expect(textA).toContain("http_requests_total");
    expect(textB).not.toContain('service="api"');
  });
});

describe("createQueueMetrics", () => {
  it("exposes queue depth, dlq depth, and oldest job age gauges", async () => {
    const registry = createMetricsRegistry("indexer");
    const { queueDepth, dlqDepth, oldestJobAgeSeconds } = createQueueMetrics(registry);

    queueDepth.set({ queue: "repo.import.requested" }, 3);
    dlqDepth.set({ queue: "repo.import.requested" }, 0);
    oldestJobAgeSeconds.set({ status: "running" }, 42);

    const text = await registry.metrics();
    expect(text).toContain("queue_depth");
    expect(text).toContain("queue_dlq_depth");
    expect(text).toContain("oldest_job_age_seconds");
  });
});

describe("createStageMetrics", () => {
  it("records a stage duration observation labeled by stage", async () => {
    const registry = createMetricsRegistry("indexer");
    const { stageDuration } = createStageMetrics(registry);

    stageDuration.observe({ stage: "parsing" }, 12.5);

    const text = await registry.metrics();
    expect(text).toContain('pipeline_stage_duration_seconds_bucket{le="15"');
  });
});

describe("createProviderMetrics", () => {
  it("exposes provider error counts, embedding duration, and chat latency", async () => {
    const registry = createMetricsRegistry("ai");
    const { providerErrorsTotal, embeddingDurationSeconds, chatLatencySeconds } = createProviderMetrics(registry);

    providerErrorsTotal.inc({ provider: "groq", kind: "timeout" });
    embeddingDurationSeconds.observe(30);
    chatLatencySeconds.observe(1.5);

    const text = await registry.metrics();
    expect(text).toContain("llm_provider_errors_total");
    expect(text).toContain("embedding_duration_seconds");
    expect(text).toContain("chat_latency_seconds");
  });
});
