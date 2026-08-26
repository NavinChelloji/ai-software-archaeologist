import { z } from "zod";

/**
 * Graph module contracts (GRAPH_SERVICE_PLAN.md "Graph Types", "UI Response
 * Shape", "APIs"). Layout positions are never part of these DTOs — React
 * Flow computes them client-side.
 */

export const GraphTypeSchema = z.enum(["folder", "dependency", "symbol"]);
export type GraphType = z.infer<typeof GraphTypeSchema>;

export const GraphNodeTypeSchema = z.enum([
  "directory",
  "file",
  "external_package",
  "class",
  "interface",
  "function",
  "method",
  "type",
  "enum",
]);
export type GraphNodeType = z.infer<typeof GraphNodeTypeSchema>;

export const GraphEdgeTypeSchema = z.enum([
  "contains",
  "imports",
  "imports_type",
  "requires",
  "imports_dynamic",
  "declares",
  "extends",
  "implements",
  "member_of",
]);
export type GraphEdgeType = z.infer<typeof GraphEdgeTypeSchema>;

export const GraphNodeDtoSchema = z.object({
  id: z.string().uuid(),
  type: GraphNodeTypeSchema,
  label: z.string(),
  path: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
});
export type GraphNodeDto = z.infer<typeof GraphNodeDtoSchema>;

export const GraphEdgeDtoSchema = z.object({
  id: z.string().uuid(),
  source: z.string().uuid(),
  target: z.string().uuid(),
  type: GraphEdgeTypeSchema,
});
export type GraphEdgeDto = z.infer<typeof GraphEdgeDtoSchema>;

/** The React Flow contract every graph query response validates against (GRAPH_SERVICE_PLAN.md "Node Caps and Truncation"). */
export const GraphResponseSchema = z.object({
  graphType: GraphTypeSchema,
  snapshotId: z.string().uuid(),
  nodes: z.array(GraphNodeDtoSchema),
  edges: z.array(GraphEdgeDtoSchema),
  truncated: z.boolean(),
  totalNodes: z.number().int().min(0),
  returnedNodes: z.number().int().min(0),
  strategy: z.literal("top-degree").optional(),
  hint: z.string().optional(),
});
export type GraphResponse = z.infer<typeof GraphResponseSchema>;

function booleanQueryParam(defaultValue: boolean) {
  return z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? defaultValue : v === "true"));
}

export const GraphFoldersQuerySchema = z.object({
  rootPath: z.string().min(1).optional(),
  maxNodes: z.coerce.number().int().positive().optional(),
});
export type GraphFoldersQuery = z.infer<typeof GraphFoldersQuerySchema>;

export const GraphDependenciesQuerySchema = z.object({
  scopePath: z.string().min(1).optional(),
  includeExternal: booleanQueryParam(true),
  maxNodes: z.coerce.number().int().positive().optional(),
});
export type GraphDependenciesQuery = z.infer<typeof GraphDependenciesQuerySchema>;

export const GraphSymbolsQuerySchema = z.object({
  filePath: z.string().min(1).optional(),
  symbolType: z.enum(["class", "interface", "function", "method", "type", "enum"]).optional(),
  maxNodes: z.coerce.number().int().positive().optional(),
});
export type GraphSymbolsQuery = z.infer<typeof GraphSymbolsQuerySchema>;

export const GraphNeighborsQuerySchema = z.object({
  direction: z.enum(["in", "out", "both"]).default("both"),
  depth: z.coerce.number().int().positive().optional(),
  maxNodes: z.coerce.number().int().positive().optional(),
});
export type GraphNeighborsQuery = z.infer<typeof GraphNeighborsQuerySchema>;

/** `types` scopes the search to one or more graphs (comma-separated `GraphType`s) — omitted searches all three. */
export const GraphSearchQuerySchema = z.object({
  q: z.string().min(1),
  types: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").map((t) => t.trim()) : undefined))
    .pipe(z.array(GraphTypeSchema).optional()),
});
export type GraphSearchQuery = z.infer<typeof GraphSearchQuerySchema>;

export const GraphSearchResultSchema = z.object({
  graphType: GraphTypeSchema,
  node: GraphNodeDtoSchema,
});
export type GraphSearchResult = z.infer<typeof GraphSearchResultSchema>;

export const GraphSearchResponseSchema = z.object({
  results: z.array(GraphSearchResultSchema),
});
export type GraphSearchResponse = z.infer<typeof GraphSearchResponseSchema>;

export const TreeQuerySchema = z.object({
  path: z.string().optional(),
  depth: z.coerce.number().int().positive().max(20).default(2),
});
export type TreeQuery = z.infer<typeof TreeQuerySchema>;

export interface TreeNodeDto {
  id: string;
  name: string;
  path: string;
  type: "directory" | "file";
  language: string | null;
  /** Present (possibly empty) once expanded within the requested `depth`; absent below that — the client re-queries `/tree?path=` to go deeper (GRAPH_SERVICE_PLAN.md "/tree ... nested structure with lazy children"). */
  children?: TreeNodeDto[];
  /** Only meaningful when `children` is absent — tells the client whether it's worth expanding further. */
  hasChildren?: boolean;
}

const TreeNodeDtoSchemaBase = z.object({
  id: z.string().uuid(),
  name: z.string(),
  path: z.string(),
  type: z.enum(["directory", "file"]),
  language: z.string().nullable(),
  hasChildren: z.boolean().optional(),
});

export const TreeNodeDtoSchema: z.ZodType<TreeNodeDto> = TreeNodeDtoSchemaBase.extend({
  children: z.lazy(() => z.array(TreeNodeDtoSchema)).optional(),
});

export const TreeResponseSchema = z.object({
  snapshotId: z.string().uuid(),
  root: TreeNodeDtoSchema,
});
export type TreeResponse = z.infer<typeof TreeResponseSchema>;
