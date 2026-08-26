import { z } from "zod";
import { ResolutionStatusSchema, SymbolTypeSchema } from "./jobs";

/**
 * File inventory and parser output DTOs
 * (REPOSITORY_PROCESSOR_SERVICE_PLAN.md "APIs"). All reads are scoped to a
 * repository's active snapshot — `indexer` resolves that internally, the
 * caller only ever names the repository.
 */

export const RepositoryFileDtoSchema = z.object({
  fileId: z.string().uuid(),
  repoId: z.string().uuid(),
  snapshotId: z.string().uuid(),
  path: z.string(),
  directory: z.string(),
  extension: z.string().nullable(),
  language: z.string().nullable(),
  sizeBytes: z.number().int().nonnegative(),
  lineCount: z.number().int().nonnegative(),
  contentHash: z.string(),
});
export type RepositoryFileDto = z.infer<typeof RepositoryFileDtoSchema>;

/** `GET /internal/repositories/:repoId/files?cursor=&pageSize=&path=` — `path` filters to entries whose path starts with the given prefix. */
export const InternalRepositoryFilesQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
  path: z.string().min(1).optional(),
});
export type InternalRepositoryFilesQuery = z.infer<typeof InternalRepositoryFilesQuerySchema>;

export const InternalRepositoryFilesResponseSchema = z.object({
  files: z.array(RepositoryFileDtoSchema),
  nextCursor: z.string().nullable(),
});
export type InternalRepositoryFilesResponse = z.infer<typeof InternalRepositoryFilesResponseSchema>;

export const CodeSymbolDtoSchema = z.object({
  symbolId: z.string().uuid(),
  repoId: z.string().uuid(),
  snapshotId: z.string().uuid(),
  fileId: z.string().uuid(),
  parentSymbolId: z.string().uuid().nullable(),
  symbolType: SymbolTypeSchema,
  name: z.string(),
  qualifiedName: z.string().nullable(),
  signature: z.string().nullable(),
  isExported: z.boolean(),
  startLine: z.number().int().nonnegative(),
  endLine: z.number().int().nonnegative(),
});
export type CodeSymbolDto = z.infer<typeof CodeSymbolDtoSchema>;

/** `GET /internal/repositories/:repoId/symbols?cursor=&type=&name=` — `name` is a case-insensitive prefix search over the indexed `lower(name)` column. */
export const InternalRepositorySymbolsQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
  type: SymbolTypeSchema.optional(),
  name: z.string().min(1).optional(),
});
export type InternalRepositorySymbolsQuery = z.infer<typeof InternalRepositorySymbolsQuerySchema>;

export const InternalRepositorySymbolsResponseSchema = z.object({
  symbols: z.array(CodeSymbolDtoSchema),
  nextCursor: z.string().nullable(),
});
export type InternalRepositorySymbolsResponse = z.infer<typeof InternalRepositorySymbolsResponseSchema>;

export const FileDependencyDtoSchema = z.object({
  id: z.string().uuid(),
  sourceFileId: z.string().uuid(),
  targetFileId: z.string().uuid().nullable(),
  targetPath: z.string().nullable(),
  externalPackage: z.string().nullable(),
  rawSpecifier: z.string(),
  importKind: z.enum(["esm", "require", "dynamic", "export_from", "type_only"]),
  resolutionStatus: ResolutionStatusSchema,
  line: z.number().int().positive().nullable(),
});
export type FileDependencyDto = z.infer<typeof FileDependencyDtoSchema>;

/** `GET /internal/files/:fileId/content?startLine=&endLine=` — both omitted returns the whole file. */
export const InternalFileContentQuerySchema = z
  .object({
    startLine: z.coerce.number().int().positive().optional(),
    endLine: z.coerce.number().int().positive().optional(),
  })
  .refine((q) => q.startLine === undefined || q.endLine === undefined || q.endLine >= q.startLine, {
    message: "endLine must be greater than or equal to startLine",
  });
export type InternalFileContentQuery = z.infer<typeof InternalFileContentQuerySchema>;

export const InternalFileContentResponseSchema = z.object({
  fileId: z.string().uuid(),
  path: z.string(),
  language: z.string().nullable(),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  content: z.string(),
});
export type InternalFileContentResponse = z.infer<typeof InternalFileContentResponseSchema>;
