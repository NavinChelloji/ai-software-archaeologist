import { z } from "zod";
import { SymbolTypeSchema } from "./jobs";

/**
 * Retrieval module contracts (SEARCH_EMBEDDING_SERVICE_PLAN.md "APIs").
 * Every chunk carries the fields a citation needs — `path`, line range,
 * symbol name — so Chat (Stage 9) can turn a retrieved chunk directly into
 * a clickable `path:startLine-endLine` citation without a second lookup.
 */

export const ChunkDtoSchema = z.object({
  chunkId: z.string().uuid(),
  path: z.string(),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  symbolName: z.string().nullable(),
  symbolType: SymbolTypeSchema.nullable(),
  language: z.string().nullable(),
  score: z.number(),
  content: z.string(),
});
export type ChunkDto = z.infer<typeof ChunkDtoSchema>;

export const RetrievalFiltersSchema = z.object({
  pathPrefix: z.string().min(1).optional(),
  language: z.string().min(1).optional(),
  symbolType: SymbolTypeSchema.optional(),
});
export type RetrievalFilters = z.infer<typeof RetrievalFiltersSchema>;

/** `POST /internal/repositories/:repoId/retrieve` — hybrid vector + lexical + metadata retrieval for chat grounding. */
export const RetrieveRequestSchema = z.object({
  query: z.string().min(1),
  topK: z.coerce.number().int().positive().max(100).optional(),
  filters: RetrievalFiltersSchema.optional(),
});
export type RetrieveRequest = z.infer<typeof RetrieveRequestSchema>;

export const RetrieveResponseSchema = z.object({
  chunks: z.array(ChunkDtoSchema),
  totalCandidates: z.number().int().min(0),
  snapshotId: z.string().uuid().nullable(),
});
export type RetrieveResponse = z.infer<typeof RetrieveResponseSchema>;

/**
 * `POST /internal/repositories/:repoId/search` — lexical/metadata-only
 * lookup (path, symbol name), no query embedding involved. For "jump to
 * this file/symbol" style lookups where a full hybrid retrieval pass would
 * be needless embedding-model latency for a query that's already exact.
 */
export const SearchRequestSchema = z.object({
  q: z.string().min(1),
  topK: z.coerce.number().int().positive().max(100).optional(),
  filters: RetrievalFiltersSchema.optional(),
});
export type SearchRequest = z.infer<typeof SearchRequestSchema>;

export const SearchResponseSchema = z.object({
  chunks: z.array(ChunkDtoSchema),
  totalCandidates: z.number().int().min(0),
  snapshotId: z.string().uuid().nullable(),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;

export const ChunkByIdResponseSchema = ChunkDtoSchema;
export type ChunkByIdResponse = z.infer<typeof ChunkByIdResponseSchema>;
