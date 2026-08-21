import { z } from "zod";
import { StageProgressSchema } from "./jobs";

/**
 * The five stages that do real work, in order
 * (JOB_ORCHESTRATOR_SERVICE_PLAN.md "Stage Machine"). Re-derived from
 * StageProgressSchema's `stage` field so the two can never drift apart.
 */
export const PROCESSING_STAGES = StageProgressSchema.shape.stage.options;
export const ProcessingStageSchema = StageProgressSchema.shape.stage;
export type ProcessingStage = z.infer<typeof ProcessingStageSchema>;

/**
 * `processing_jobs.current_stage` — the full chain from the Stage Machine
 * diagram, including the states before and after the five processing
 * stages. This is finer-grained than `status`.
 */
export const JOB_STAGES = ["queued", ...PROCESSING_STAGES, "completed", "failed", "cancelled"] as const;
export const JobStageSchema = z.enum(JOB_STAGES);
export type JobStage = z.infer<typeof JobStageSchema>;

/** `processing_jobs.status` — the coarse view a client branches on. */
export const JOB_STATUSES = ["queued", "running", "completed", "failed", "cancelled"] as const;
export const JobStatusSchema = z.enum(JOB_STATUSES);
export type JobStatus = z.infer<typeof JobStatusSchema>;

/** Maps a fine-grained stage to the coarse status a client actually branches on. */
export function statusForStage(stage: JobStage): JobStatus {
  if (stage === "queued" || stage === "completed" || stage === "failed" || stage === "cancelled") {
    return stage;
  }
  return "running";
}

/**
 * Fixed progress-percent boundaries per stage
 * (JOB_ORCHESTRATOR_SERVICE_PLAN.md "Stage Machine" table). Progress within
 * a stage is interpolated from `itemsProcessed / totalItems` between
 * `min` and `max`; no stage reports a percentage it cannot substantiate.
 */
export const STAGE_PROGRESS_RANGES: Record<ProcessingStage | "queued" | "completed", { min: number; max: number }> = {
  queued: { min: 0, max: 0 },
  snapshotting: { min: 0, max: 10 },
  extracting: { min: 10, max: 30 },
  parsing: { min: 30, max: 60 },
  graphing: { min: 60, max: 75 },
  embedding: { min: 75, max: 99 },
  completed: { min: 100, max: 100 },
};

/** `processing_jobs` row, shaped for API responses (internal and public alike — see RepositoryDto for the same internal/public reuse pattern). */
export const ProcessingJobDtoSchema = z.object({
  jobId: z.string().uuid(),
  repoId: z.string().uuid(),
  snapshotId: z.string().uuid().nullable(),
  status: JobStatusSchema,
  stage: JobStageSchema,
  progressPercent: z.number().int().min(0).max(100),
  message: z.string().nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  retryCount: z.number().int().min(0),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ProcessingJobDto = z.infer<typeof ProcessingJobDtoSchema>;

/**
 * The progress payload published to Redis `progress:{repoId}` on every
 * state change, and streamed verbatim as SSE `data` to the browser
 * (JOB_ORCHESTRATOR_SERVICE_PLAN.md "Progress Publishing",
 * API_GATEWAY_SERVICE_PLAN.md "SSE fan-out across replicas").
 */
export const JobProgressEventSchema = z.object({
  repoId: z.string().uuid(),
  jobId: z.string().uuid(),
  status: JobStatusSchema,
  stage: JobStageSchema,
  progressPercent: z.number().int().min(0).max(100),
  message: z.string().nullable(),
  errorCode: z.string().nullable(),
  occurredAt: z.string().datetime(),
});
export type JobProgressEvent = z.infer<typeof JobProgressEventSchema>;

/** `POST /internal/jobs/:jobId/retry` and `/cancel` take no body — the job id in the path is enough. */
export const InternalJobActionResponseSchema = ProcessingJobDtoSchema;
export type InternalJobActionResponse = z.infer<typeof InternalJobActionResponseSchema>;
