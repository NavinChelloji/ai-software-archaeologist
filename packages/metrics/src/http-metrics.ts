import { Counter, Histogram, type Registry } from "prom-client";

export interface HttpMetrics {
  requestDuration: Histogram<"method" | "route" | "status_code">;
  requestsTotal: Counter<"method" | "route" | "status_code">;
}

/** HTTP latency and error rate (RULES.md #15), keyed by route rather than raw path so cardinality stays bounded regardless of `:id` values. */
export function createHttpMetrics(registry: Registry): HttpMetrics {
  const requestDuration = new Histogram({
    name: "http_request_duration_seconds",
    help: "Duration of HTTP requests in seconds.",
    labelNames: ["method", "route", "status_code"],
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
  });

  const requestsTotal = new Counter({
    name: "http_requests_total",
    help: "Total HTTP requests handled.",
    labelNames: ["method", "route", "status_code"],
    registers: [registry],
  });

  return { requestDuration, requestsTotal };
}
