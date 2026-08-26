import { z } from "zod";

/**
 * Chat module contracts (CHAT_SERVICE_PLAN.md "APIs", LLM_PROMPTING.md
 * "Citation Rules"). Citations carry `path`/line range only — never a
 * `fileId` — because they come from parsing the model's own
 * `[path:startLine-endLine]` output, not from a prior file lookup.
 */

export const CitationDtoSchema = z.object({
  path: z.string(),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  symbolName: z.string().nullable(),
});
export type CitationDto = z.infer<typeof CitationDtoSchema>;

export const ChatRoleSchema = z.enum(["user", "assistant", "system"]);
export type ChatRole = z.infer<typeof ChatRoleSchema>;

export const ConversationDtoSchema = z.object({
  conversationId: z.string().uuid(),
  repoId: z.string().uuid(),
  title: z.string().nullable(),
  messageCount: z.number().int().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ConversationDto = z.infer<typeof ConversationDtoSchema>;

export const MessageDtoSchema = z.object({
  messageId: z.string().uuid(),
  conversationId: z.string().uuid(),
  role: ChatRoleSchema,
  content: z.string(),
  citations: z.array(CitationDtoSchema),
  model: z.string().nullable(),
  promptTokens: z.number().int().min(0),
  completionTokens: z.number().int().min(0),
  latencyMs: z.number().int().nullable(),
  finishReason: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type MessageDto = z.infer<typeof MessageDtoSchema>;

// ---------------------------------------------------------------------------
// Public APIs — `GET/POST /api/v1/repositories/:repoId/conversations`,
// `GET /api/v1/conversations/:conversationId/messages`,
// `POST /api/v1/conversations/:conversationId/messages` (SSE).
// ---------------------------------------------------------------------------

export const CreateConversationRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
});
export type CreateConversationRequest = z.infer<typeof CreateConversationRequestSchema>;

export const ConversationsListQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type ConversationsListQuery = z.infer<typeof ConversationsListQuerySchema>;

export const ConversationsListResponseSchema = z.object({
  conversations: z.array(ConversationDtoSchema),
  nextCursor: z.string().nullable(),
});
export type ConversationsListResponse = z.infer<typeof ConversationsListResponseSchema>;

export const MessagesListQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type MessagesListQuery = z.infer<typeof MessagesListQuerySchema>;

export const MessagesListResponseSchema = z.object({
  messages: z.array(MessageDtoSchema),
  nextCursor: z.string().nullable(),
});
export type MessagesListResponse = z.infer<typeof MessagesListResponseSchema>;

/** `MESSAGE_TOO_LONG` above 4000 chars (API_ERROR_CODES.md). */
export const SendMessageRequestSchema = z.object({
  content: z.string().min(1).max(4000),
});
export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;

// ---------------------------------------------------------------------------
// Internal APIs — `api` -> `ai`, `/internal/*`. `userId` travels as an
// explicit field (never inferred from the internal token alone), matching
// the existing InternalImportRepositoryRequest/ownership-check precedent in
// the indexer's internal surface.
// ---------------------------------------------------------------------------

export const InternalCreateConversationRequestSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
});
export type InternalCreateConversationRequest = z.infer<typeof InternalCreateConversationRequestSchema>;

export const InternalConversationsListQuerySchema = z.object({
  userId: z.string().uuid(),
  cursor: z.string().min(1).optional(),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type InternalConversationsListQuery = z.infer<typeof InternalConversationsListQuerySchema>;

export const InternalMessagesListQuerySchema = z.object({
  userId: z.string().uuid(),
  cursor: z.string().min(1).optional(),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type InternalMessagesListQuery = z.infer<typeof InternalMessagesListQuerySchema>;

export const InternalSendMessageRequestSchema = z.object({
  userId: z.string().uuid(),
  content: z.string().min(1).max(4000),
});
export type InternalSendMessageRequest = z.infer<typeof InternalSendMessageRequestSchema>;

export const InternalConversationActionQuerySchema = z.object({
  userId: z.string().uuid(),
});
export type InternalConversationActionQuery = z.infer<typeof InternalConversationActionQuerySchema>;

// ---------------------------------------------------------------------------
// SSE event payloads on the message stream (CHAT_SERVICE_PLAN.md "SSE event
// types"). `api` proxies the byte stream straight through — these schemas
// exist for `ai`'s own construction/tests and the frontend's parser, not as
// a wire-level validation gate.
// ---------------------------------------------------------------------------

export const ChatTokenEventSchema = z.object({ delta: z.string() });
export type ChatTokenEvent = z.infer<typeof ChatTokenEventSchema>;

export const ChatCitationEventSchema = CitationDtoSchema;
export type ChatCitationEvent = CitationDto;

export const ChatUsageEventSchema = z.object({
  promptTokens: z.number().int().min(0),
  completionTokens: z.number().int().min(0),
});
export type ChatUsageEvent = z.infer<typeof ChatUsageEventSchema>;

export const ChatDoneEventSchema = z.object({ messageId: z.string().uuid() });
export type ChatDoneEvent = z.infer<typeof ChatDoneEventSchema>;

export const ChatErrorEventSchema = z.object({
  code: z.string(),
  correlationId: z.string().uuid(),
});
export type ChatErrorEvent = z.infer<typeof ChatErrorEventSchema>;
