import { collectDefaultMetrics, Registry } from "prom-client";

/**
 * One registry per process, labeled with the deployable's own `service` name
 * so a single Prometheus instance scraping all four deployables can tell
 * their series apart without per-job relabeling (RULES.md #15 "Metrics for
 * HTTP latency, error rate, queue depth, job age, stage duration, embedding
 * duration, chat latency, and provider errors").
 */
export function createMetricsRegistry(serviceName: string): Registry {
  const registry = new Registry();
  registry.setDefaultLabels({ service: serviceName });
  collectDefaultMetrics({ register: registry });
  return registry;
}
