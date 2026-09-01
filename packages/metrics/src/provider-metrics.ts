import { Counter, Histogram, type Registry } from "prom-client";

export interface ProviderMetrics {
  providerErrorsTotal: Counter<"provider" | "kind">;
  embeddingDurationSeconds: Histogram<never>;
  chatLatencySeconds: Histogram<never>;
}

/** LLM/embedding provider errors, embedding duration, and chat latency (RULES.md #15) — `ai`-specific. */
export function createProviderMetrics(registry: Registry): ProviderMetrics {
  const providerErrorsTotal = new Counter({
    name: "llm_provider_errors_total",
    help: "Total errors returned by an LLM or embedding provider.",
    labelNames: ["provider", "kind"],
    registers: [registry],
  });

  const embeddingDurationSeconds = new Histogram({
    name: "embedding_duration_seconds",
    help: "Duration of one embedding run in seconds.",
    buckets: [1, 5, 15, 30, 60, 120, 300, 600, 1200],
    registers: [registry],
  });

  const chatLatencySeconds = new Histogram({
    name: "chat_latency_seconds",
    help: "End-to-end latency of one chat answer in seconds.",
    buckets: [0.5, 1, 2, 5, 10, 20, 30, 60],
    registers: [registry],
  });

  return { providerErrorsTotal, embeddingDurationSeconds, chatLatencySeconds };
}
