import { Histogram, type Registry } from "prom-client";

export interface StageMetrics {
  stageDuration: Histogram<"stage">;
}

/** Per-stage pipeline duration (RULES.md #15 "stage duration"), observed from the `durationMs` every stage-completion event already carries (EVENT_CONTRACTS.md `StageProgress`). */
export function createStageMetrics(registry: Registry): StageMetrics {
  const stageDuration = new Histogram({
    name: "pipeline_stage_duration_seconds",
    help: "Duration of one pipeline stage in seconds.",
    labelNames: ["stage"],
    buckets: [1, 5, 15, 30, 60, 120, 300, 600, 1200, 1800],
    registers: [registry],
  });

  return { stageDuration };
}
