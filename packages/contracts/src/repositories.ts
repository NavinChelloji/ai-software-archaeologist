import { z } from "zod";

/**
 * A single entry from the user's live GitHub listing (`GET
 * /api/v1/github/repositories`). Never persisted — `indexer` re-fetches
 * authoritative data at import time (GITHUB_CONNECTOR_SERVICE_PLAN.md).
 */
export const GithubRepositoryDtoSchema = z.object({
  providerRepoId: z.string().min(1),
  name: z.string().min(1),
  fullName: z.string().min(1),
  ownerLogin: z.string().min(1),
  private: z.boolean(),
  defaultBranch: z.string().min(1),
  description: z.string().nullable(),
  language: z.string().nullable(),
  sizeKb: z.number().int().nonnegative(),
  stargazersCount: z.number().int().nonnegative(),
  updatedAt: z.string().datetime().nullable(),
  htmlUrl: z.string().url(),
});
export type GithubRepositoryDto = z.infer<typeof GithubRepositoryDtoSchema>;

/** `GET /api/v1/github/repositories?page=&perPage=&search=`. GitHub itself is page-numbered, not cursor-based. */
export const GithubRepositoriesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(30),
  search: z.string().trim().max(200).optional(),
});
export type GithubRepositoriesQuery = z.infer<typeof GithubRepositoriesQuerySchema>;

export const GithubRepositoriesResponseSchema = z.object({
  repositories: z.array(GithubRepositoryDtoSchema),
  page: z.number().int().positive(),
  perPage: z.number().int().positive(),
  hasNextPage: z.boolean(),
});
export type GithubRepositoriesResponse = z.infer<typeof GithubRepositoriesResponseSchema>;

/**
 * The canonical, imported repository (`indexer.repositories`, CODEBASE.md
 * "repoId is minted only by indexer"). `activeSnapshotId` stays null until a
 * later stage's pipeline completes a snapshot.
 */
export const RepositoryDtoSchema = z.object({
  repoId: z.string().uuid(),
  fullName: z.string().min(1),
  defaultBranch: z.string().min(1),
  isPrivate: z.boolean(),
  primaryLanguage: z.string().nullable(),
  activeSnapshotId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type RepositoryDto = z.infer<typeof RepositoryDtoSchema>;

/** `GET /api/v1/repositories?cursor=&pageSize=` — the signed-in user's already-imported repositories. */
export const RepositoriesListQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type RepositoriesListQuery = z.infer<typeof RepositoriesListQuerySchema>;

export const RepositoriesListResponseSchema = z.object({
  repositories: z.array(RepositoryDtoSchema),
  nextCursor: z.string().nullable(),
});
export type RepositoriesListResponse = z.infer<typeof RepositoriesListResponseSchema>;

/** `POST /api/v1/repositories/import`. The client only needs to name the repo — `indexer` re-verifies everything else. */
export const ImportRepositoryRequestSchema = z.object({
  providerRepoId: z.string().min(1),
});
export type ImportRepositoryRequest = z.infer<typeof ImportRepositoryRequestSchema>;

export const ImportRepositoryResponseSchema = RepositoryDtoSchema.extend({
  /** False when this import re-used an existing row (RULES.md "importing twice does not duplicate"). */
  created: z.boolean(),
});
export type ImportRepositoryResponse = z.infer<typeof ImportRepositoryResponseSchema>;

/**
 * `POST /internal/repositories/import`. Deliberately minimal — `api` only
 * asserts who is asking and which GitHub repo they mean; `indexer` fetches
 * the authoritative metadata itself via the just-in-time GitHub token
 * (GITHUB_CONNECTOR_SERVICE_PLAN.md "It does not store GitHub tokens").
 */
export const InternalImportRepositoryRequestSchema = z.object({
  ownerUserId: z.string().uuid(),
  provider: z.literal("github"),
  providerRepoId: z.string().min(1),
});
export type InternalImportRepositoryRequest = z.infer<typeof InternalImportRepositoryRequestSchema>;

export const InternalImportRepositoryResponseSchema = ImportRepositoryResponseSchema;
export type InternalImportRepositoryResponse = z.infer<typeof InternalImportRepositoryResponseSchema>;

export const InternalRepositoriesListQuerySchema = z.object({
  ownerUserId: z.string().uuid(),
  cursor: z.string().min(1).optional(),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type InternalRepositoriesListQuery = z.infer<typeof InternalRepositoriesListQuerySchema>;

/**
 * `GET /internal/repositories/:repoId/ownership?userId=` — backs the
 * Gateway's 60-second ownership cache (API_GATEWAY_SERVICE_PLAN.md). `owns`
 * is `false` for both "not this user's repo" and "no such repo", on purpose
 * (RULES.md #13: never let a 403 and a 404 distinguish the two cases).
 */
export const InternalRepositoryOwnershipResponseSchema = z.object({
  owns: z.boolean(),
});
export type InternalRepositoryOwnershipResponse = z.infer<typeof InternalRepositoryOwnershipResponseSchema>;

export const InternalRepositoryOwnershipQuerySchema = z.object({
  userId: z.string().uuid(),
});
export type InternalRepositoryOwnershipQuery = z.infer<typeof InternalRepositoryOwnershipQuerySchema>;

/**
 * `DELETE /api/v1/repositories/:repoId` (DEVELOPMENT_STAGES.md Stage 10,
 * DATA_RETENTION_AND_PRIVACY.md "Repository deletion"). The row disappears
 * from the user's list immediately (synchronous soft-delete at `indexer`);
 * the full cascade and S3 cleanup finish asynchronously via `repo.deleted`,
 * hence "deleting" rather than "deleted".
 */
export const DeleteRepositoryResponseSchema = z.object({
  repoId: z.string().uuid(),
  status: z.literal("deleting"),
});
export type DeleteRepositoryResponse = z.infer<typeof DeleteRepositoryResponseSchema>;

/**
 * `GET /internal/repositories/:repoId/snapshots` — the snapshot ids
 * `indexer` currently retains for this repository, after any pruning. `ai`
 * uses this to know which `snapshot_chunks` rows are still valid when it has
 * no snapshot table of its own to consult (EVENT_CONTRACTS.md
 * `snapshot.prune`).
 */
export const InternalRepositorySnapshotsResponseSchema = z.object({
  snapshotIds: z.array(z.string().uuid()),
});
export type InternalRepositorySnapshotsResponse = z.infer<typeof InternalRepositorySnapshotsResponseSchema>;
