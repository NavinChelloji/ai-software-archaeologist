import { z } from "zod";

/**
 * The 15 job names from EVENT_CONTRACTS.md. This is the exhaustive product
 * job vocabulary — do not add a name here for infrastructure/smoke-test
 * jobs that aren't part of the documented pipeline.
 */
export const JOB_NAMES = [
  "repo.import.requested",
  "repo.snapshot.created",
  "repo.files.indexed",
  "repo.symbols.extracted",
  "repo.dependencies.extracted",
  "repo.graph.built",
  "repo.index.requested",
  "repo.embeddings.completed",
  "repo.stage.failed",
  "repo.processing.completed",
  "repo.processing.failed",
  "chat.answer.completed",
  "repo.deleted",
  "user.deleted",
  "snapshot.prune",
] as const;

export const JobNameSchema = z.enum(JOB_NAMES);
export type JobName = z.infer<typeof JobNameSchema>;

export const StageProgressSchema = z.object({
  stage: z.enum(["snapshotting", "extracting", "parsing", "graphing", "embedding"]),
  batchIndex: z.number().int().min(0),
  batchCount: z.number().int().min(1),
  itemsProcessed: z.number().int().min(0),
  totalItems: z.number().int().min(0),
  durationMs: z.number().int().min(0),
});
export type StageProgress = z.infer<typeof StageProgressSchema>;

const RepoImportRequestedPayload = z.object({
  provider: z.literal("github"),
  providerRepoId: z.string(),
  fullName: z.string(),
  defaultBranch: z.string(),
  isPrivate: z.boolean(),
  ref: z.string().nullable(),
  reindex: z.boolean(),
});

const RepoSnapshotCreatedPayload = z
  .object({
    commitSha: z.string(),
    ref: z.string(),
    archiveKey: z.string(),
    sizeBytes: z.number().int().min(0),
    reused: z.boolean(),
  })
  .extend(StageProgressSchema.shape);

const SkippedReasonSchema = z.enum([
  "ignored",
  "binary",
  "too_large",
  "excluded_secret",
  "generated",
]);

const RepoFilesIndexedPayload = z
  .object({
    commitSha: z.string(),
    manifestKey: z.string(),
    fileCount: z.number().int().min(0),
    skippedCount: z.number().int().min(0),
    skippedReasons: z.record(SkippedReasonSchema, z.number().int().min(0)),
    languages: z.record(z.string(), z.number().int().min(0)),
  })
  .extend(StageProgressSchema.shape);

const SymbolTypeSchema = z.enum([
  "class",
  "interface",
  "function",
  "method",
  "type",
  "enum",
  "variable",
]);

const RepoSymbolsExtractedPayload = z
  .object({
    commitSha: z.string(),
    symbolCount: z.number().int().min(0),
    languageSupported: z.boolean(),
    byType: z.record(SymbolTypeSchema, z.number().int().min(0)),
  })
  .extend(StageProgressSchema.shape);

const ResolutionStatusSchema = z.enum([
  "resolved",
  "external",
  "unresolved",
  "dynamic_unresolvable",
]);

const RepoDependenciesExtractedPayload = z
  .object({
    commitSha: z.string(),
    edgeCount: z.number().int().min(0),
    languageSupported: z.boolean(),
    byResolution: z.record(ResolutionStatusSchema, z.number().int().min(0)),
  })
  .extend(StageProgressSchema.shape);

const GraphCountsSchema = z.object({
  nodes: z.number().int().min(0),
  edges: z.number().int().min(0),
});

const RepoGraphBuiltPayload = z
  .object({
    commitSha: z.string(),
    graphs: z.object({
      folder: GraphCountsSchema,
      dependency: GraphCountsSchema,
      symbol: GraphCountsSchema,
    }),
  })
  .extend(StageProgressSchema.shape);

const RepoIndexRequestedPayload = z.object({
  commitSha: z.string(),
  manifestKey: z.string(),
  previousSnapshotId: z.string().uuid().nullable(),
});

const RepoEmbeddingsCompletedPayload = z
  .object({
    commitSha: z.string(),
    chunkCount: z.number().int().min(0),
    embeddedCount: z.number().int().min(0),
    reusedCount: z.number().int().min(0),
    promptTokens: z.number().int().min(0),
    embeddingModel: z.string(),
  })
  .extend(StageProgressSchema.shape);

const RepoStageFailedPayload = z.object({
  stage: z.enum(["snapshotting", "extracting", "parsing", "graphing", "embedding"]),
  errorCode: z.string(),
  message: z.string(),
  retryable: z.boolean(),
  detail: z.record(z.string(), z.unknown()),
});

const RepoProcessingCompletedPayload = z.object({
  commitSha: z.string(),
  jobId: z.string().uuid(),
  durationMs: z.number().int().min(0),
  fileCount: z.number().int().min(0),
  symbolCount: z.number().int().min(0),
  chunkCount: z.number().int().min(0),
});

const RepoProcessingFailedPayload = z.object({
  jobId: z.string().uuid(),
  stage: z.string(),
  errorCode: z.string(),
  message: z.string(),
  retryCount: z.number().int().min(0),
});

const ChatAnswerCompletedPayload = z.object({
  conversationId: z.string().uuid(),
  messageId: z.string().uuid(),
  snapshotId: z.string().uuid(),
  model: z.string(),
  promptTokens: z.number().int().min(0),
  completionTokens: z.number().int().min(0),
  citationCount: z.number().int().min(0),
  latencyMs: z.number().int().min(0),
});

const RepoDeletedPayload = z.object({
  repoId: z.string().uuid(),
  reason: z.enum(["user_request", "account_deletion"]),
});

const UserDeletedPayload = z.object({
  userId: z.string().uuid(),
  repoIds: z.array(z.string().uuid()),
});

const SnapshotPrunePayload = z.object({
  repoId: z.string().uuid(),
  retainCount: z.number().int().min(0),
});

/**
 * One payload schema per job name, keyed so a payload can never be
 * validated against the wrong job's contract. `satisfies` keeps this
 * exhaustive against JobName without widening the value types.
 */
export const JobPayloadSchemas = {
  "repo.import.requested": RepoImportRequestedPayload,
  "repo.snapshot.created": RepoSnapshotCreatedPayload,
  "repo.files.indexed": RepoFilesIndexedPayload,
  "repo.symbols.extracted": RepoSymbolsExtractedPayload,
  "repo.dependencies.extracted": RepoDependenciesExtractedPayload,
  "repo.graph.built": RepoGraphBuiltPayload,
  "repo.index.requested": RepoIndexRequestedPayload,
  "repo.embeddings.completed": RepoEmbeddingsCompletedPayload,
  "repo.stage.failed": RepoStageFailedPayload,
  "repo.processing.completed": RepoProcessingCompletedPayload,
  "repo.processing.failed": RepoProcessingFailedPayload,
  "chat.answer.completed": ChatAnswerCompletedPayload,
  "repo.deleted": RepoDeletedPayload,
  "user.deleted": UserDeletedPayload,
  "snapshot.prune": SnapshotPrunePayload,
} satisfies Record<JobName, z.ZodTypeAny>;

export type JobPayload<T extends JobName> = z.infer<(typeof JobPayloadSchemas)[T]>;
