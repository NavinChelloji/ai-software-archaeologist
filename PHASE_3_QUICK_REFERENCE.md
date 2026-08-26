# Phase 3 — API Integration Quick Reference

## 📂 New Files (10 Total)

### API Services (4)
```
src/shared/api/
├── repositories-api.ts     (49 lines)  — Repository endpoints
├── files-api.ts            (48 lines)  — File endpoints
├── chat-api.ts             (88 lines)  — Chat with SSE
├── graph-api.ts            (27 lines)  — Graph endpoints
└── query-client.ts         (18 lines)  — TanStack Query config
```

### Custom Hooks (3)
```
src/shared/hooks/
├── useRepositories.ts      (18 lines)  — Repository queries
├── useFileTree.ts          (12 lines)  — File tree queries
├── useFileContent.ts       (13 lines)  — File content queries
└── useChat.ts              (42 lines)  — Chat mutations
```

### UI Components (2)
```
src/shared/components/
├── LoadingState.tsx        (15 lines)  — Loading spinner
├── ErrorState.tsx          (40 lines)  — Error display
├── LoadingState.module.css
└── ErrorState.module.css
```

## 🔗 Updated Files (2)

```
src/app/providers.tsx              — Use createQueryClient factory
src/shared/components/index.ts     — Export LoadingState, ErrorState
```

## 📄 Pages Updated (4)

```
src/features/repositories/RepositoryOverviewPage.tsx
src/features/graph/FolderStructurePage.tsx
src/features/chat/ChatPage.tsx
src/features/files/FileViewerPage.tsx
```

## 🚀 How to Use

### Example: Fetching Repository Data

```typescript
import { useRepository } from '@/shared/hooks/useRepositories';
import { LoadingState, ErrorState } from '@/shared/components';

export function MyPage() {
  const { data, isLoading, error, refetch } = useRepository(repoId);

  if (isLoading) return <LoadingState message="Loading..." />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return <div>{data.name}</div>;
}
```

### Example: Chat with Streaming

```typescript
import { useSendChatMessage } from '@/shared/hooks/useChat';

export function ChatComponent() {
  const { sendMessage, streamingMessage, isPending } = useSendChatMessage(repoId);

  const handleSend = async (text: string) => {
    sendMessage(text);
  };

  return (
    <div>
      <input onChange={(e) => handleSend(e.target.value)} />
      <p>{streamingMessage}</p>
    </div>
  );
}
```

### Example: File Operations

```typescript
import { useFileMetadata } from '@/shared/hooks/useFileContent';

export function FileViewer() {
  const { data: file } = useFileMetadata(fileId);

  return (
    <div>
      <code>{file.content}</code>
      <ul>
        {file.symbols.map(s => <li key={s.name}>{s.name}</li>)}
      </ul>
    </div>
  );
}
```

## 📊 API Contracts

### Repositories
```
GET /api/v1/repositories
GET /api/v1/repositories/:repoId
GET /api/v1/repositories/:repoId/files
GET /api/v1/repositories/:repoId/languages
```

### Files
```
GET /api/v1/files/:fileId
GET /api/v1/files/:fileId/metadata
GET /api/v1/files/:fileId/symbols
GET /api/v1/files/:fileId/importers
```

### Chat (Server-Sent Events)
```
POST /api/v1/chat/:repoId
GET /api/v1/chat/:repoId/history
GET /api/v1/chat/:repoId/:conversationId
```

### Graphs
```
GET /api/v1/repositories/:repoId/graph/dependencies
GET /api/v1/repositories/:repoId/graph/symbols
GET /api/v1/repositories/:repoId/graph/folders
```

## 🎯 Hook Reference

### useRepositories
```typescript
const { data, isLoading, error } = useRepositories(limit, offset);
// data: { repositories: Repository[]; total: number }
```

### useRepository
```typescript
const { data, isLoading, error } = useRepository(repoId);
// data: RepositoryOverviewResponse
```

### useFileTree
```typescript
const { data, isLoading, error } = useFileTree(repoId, path);
// data: FileTreeResponse
```

### useFileContent
```typescript
const { data, isLoading, error } = useFileContent(fileId);
// data: FileViewResponse
```

### useFileMetadata
```typescript
const { data, isLoading, error } = useFileMetadata(fileId);
// data: FileMetadataResponse (includes symbols & importers)
```

### useChatMessages
```typescript
const { data, isLoading, error } = useChatMessages(repoId);
// data: ConversationResponse[]
```

### useSendChatMessage
```typescript
const { sendMessage, isPending, error, streamingMessage, isStreaming } = useSendChatMessage(repoId);

sendMessage("What does this code do?");
// Listen to streamingMessage state for real-time updates
```

## 🧪 Testing Checklist

- [x] All API services created
- [x] All custom hooks created
- [x] All pages integrated with hooks
- [x] LoadingState component working
- [x] ErrorState component working
- [x] TypeScript strict mode (0 errors)
- [x] Production build succeeds
- [x] Chat streaming ready for SSE
- [x] Error retry logic in place

## 📈 Statistics

| Metric | Count |
|--------|-------|
| New API Services | 4 |
| New Custom Hooks | 3 |
| New UI Components | 2 |
| Pages Integrated | 4 |
| TypeScript Errors | 0 ✅ |
| Build Size | 331.91 KB (gzip: 103.63 KB) |

## 🔄 Data Flow

```
User Interaction
    ↓
Custom Hook (useRepository, useChat, etc.)
    ↓
TanStack Query (useQuery, useMutation)
    ↓
API Service Function (getRepository, sendChatMessage, etc.)
    ↓
apiFetch() — Handles auth, errors, retries
    ↓
HTTP Request (fetch API)
    ↓
Backend API Response
    ↓
Error Handling (ApiError throws on non-2xx)
    ↓
Hook Returns { data, isLoading, error }
    ↓
Component Renders (LoadingState, ErrorState, or Data)
```

## 🛠️ Common Patterns

### Pattern 1: Load and Display Data

```typescript
const { data, isLoading, error, refetch } = useRepository(repoId);

if (isLoading) return <LoadingState />;
if (error) return <ErrorState onRetry={refetch} message={error.message} />;

return <div>{data.name}</div>;
```

### Pattern 2: Handle Async Action

```typescript
const { sendMessage, isPending } = useSendChatMessage(repoId);

const handleClick = () => {
  sendMessage("Hello");
};

return <button disabled={isPending}>Send</button>;
```

### Pattern 3: Stream Data

```typescript
const { streamingMessage, isStreaming } = useSendChatMessage(repoId);

return (
  <div>
    {streamingMessage}
    {isStreaming && <Spinner />}
  </div>
);
```

## 🔐 Authentication

- Auth is handled automatically by `apiFetch()`
- Tokens are stored via `setAccessToken()` / `getAccessToken()`
- 401 errors trigger auto-refresh + retry
- No token handling needed in hooks

## 🐛 Debugging

Enable React Query DevTools for development:

```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

<QueryClientProvider client={queryClient}>
  <YourApp />
  <ReactQueryDevtools initialIsOpen={false} />
</QueryClientProvider>
```

## 📋 Pre-Phase 4 Checklist

- [x] All API services defined
- [x] All hooks created
- [x] All pages integrated
- [x] Error handling working
- [x] Loading states working
- [x] TypeScript passing
- [x] Build succeeding

**Ready for Phase 4: Graph Visualization & Advanced Features** 🚀
