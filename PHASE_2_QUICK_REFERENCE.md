# Phase 2 — Quick Reference Guide

## 📂 All New Files at a Glance

### Pages (5 Pages, 10 Files)

```
src/features/repositories/
├── RepositoryOverviewPage.tsx         (110 lines)
└── RepositoryOverviewPage.module.css  (180 lines)

src/features/graph/
├── FolderStructurePage.tsx            (95 lines)
└── FolderStructurePage.module.css     (160 lines)

src/features/chat/
├── ChatPage.tsx                       (105 lines)
└── ChatPage.module.css                (140 lines)

src/features/files/
├── FileViewerPage.tsx                 (120 lines)
└── FileViewerPage.module.css          (180 lines)
```

### Components (2 Components, 4 Files)

```
src/shared/components/
├── FileTree.tsx                       (80 lines)
├── FileTree.module.css                (80 lines)
├── ChatMessage.tsx                    (65 lines)
└── ChatMessage.module.css             (120 lines)
```

### Updated Files (3 Files)

```
src/app/routes.tsx                     (updated with 4 new routes)
src/shared/components/index.ts         (added 2 exports)
```

## 🚀 How to Use Each Component

### FileTree Component

```tsx
import { FileTree, type FileNode } from '@/shared/components';

const data: FileNode[] = [
  {
    id: '1',
    name: 'src',
    type: 'folder',
    children: [
      { id: '1-1', name: 'app.ts', type: 'file', size: 2048 },
    ],
  },
];

<FileTree
  data={data}
  selectedFile={selectedId}
  onSelectFile={(node) => console.log(node)}
/>
```

### ChatMessage Component

```tsx
import { ChatMessage, type Citation } from '@/shared/components';

const citations: Citation[] = [
  {
    fileId: '123',
    filePath: 'src/app.ts',
    startLine: 1,
    endLine: 10,
  },
];

<ChatMessage
  role="assistant"
  content="This is the response..."
  citations={citations}
  timestamp={new Date()}
  onCitationClick={(citation) => {
    // Handle citation click
  }}
/>
```

## 🛣️ New Routes

| Path | Component | Purpose |
|------|-----------|---------|
| `/repositories/:repoId` | RepositoryOverviewPage | View repo stats, language breakdown |
| `/repositories/:repoId/structure` | FolderStructurePage | Browse file tree |
| `/repositories/:repoId/chat` | ChatPage | Chat with AI about repo |
| `/files/:fileId` | FileViewerPage | View code with line numbers |

## 🎯 Mock Data Locations

Each page includes mock data ready for replacement:

- **RepositoryOverviewPage:** Lines 16-60
- **FolderStructurePage:** Lines 10-45
- **ChatPage:** Lines 17-24
- **FileViewerPage:** Lines 10-50

All have clear `// Mock data - replace with API call` comments.

## 🔗 Component Dependencies

```
FileTree
├── Uses: Card (from shared/components)
├── Uses: Input (from shared/components)
└── Exports: FileNode type

ChatMessage
├── Uses: Badge (from shared/components)
└── Exports: Citation type

RepositoryOverviewPage
├── Uses: Card, Badge
└── Uses: Language stats mock data

FolderStructurePage
├── Uses: Card, Input, FileTree
└── Manages file selection state

ChatPage
├── Uses: Card, Input, Button, ChatMessage
└── Manages message history state

FileViewerPage
├── Uses: Card, Badge
└── Manages code highlighting
```

## 🎨 Styling Applied

All new pages/components include:

✅ **Dark Mode Support** — CSS variables automatically adapt  
✅ **Responsive Design** — Mobile first (tested at 768px breakpoint)  
✅ **Claymorphism** — Soft shadows, rounded corners, depth  
✅ **Accessibility** — Semantic HTML, ARIA labels  
✅ **Animations** — Smooth transitions and micro-interactions  

## 📊 Component Props Reference

### FileTree

```typescript
interface FileTreeProps {
  data: FileNode[];
  onSelectFile?: (node: FileNode) => void;
  selectedFile?: string;
}

interface FileNode {
  id: string;
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
  size?: number;
  language?: string;
}
```

### ChatMessage

```typescript
interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  timestamp?: Date;
  loading?: boolean;
  onCitationClick?: (citation: Citation) => void;
}

interface Citation {
  fileId: string;
  filePath: string;
  startLine: number;
  endLine: number;
}
```

## 🧪 Testing Checklist for Phase 2

- [x] All TypeScript compiles (0 errors)
- [x] Production build succeeds
- [x] All new components exported
- [x] All routes registered
- [x] Responsive at 768px+ breakpoints
- [x] Dark mode CSS applied
- [x] Mock data in place

## 📱 Responsive Behavior

### Desktop (1024px+)
- Sidebar visible
- Full 2-panel layouts
- All details visible

### Tablet (640px-1023px)
- Sidebar visible but narrower
- Some layouts convert to 1 column
- Details panel hidden on smaller screens

### Mobile (< 640px)
- Horizontal sidebar (converted to nav)
- Single column layouts
- Touch-friendly spacing
- Simplified details views

## 🔄 Next: API Integration Points

For Phase 3, replace mock data at these points:

**RepositoryOverviewPage:**
```typescript
const { data: repository } = useQuery({
  queryKey: ['repository', repoId],
  queryFn: () => api.getRepository(repoId),
});
```

**FolderStructurePage:**
```typescript
const { data: fileTree } = useQuery({
  queryKey: ['fileTree', repoId],
  queryFn: () => api.getFileTree(repoId),
});
```

**ChatPage:**
```typescript
const sendMessage = async (text: string) => {
  const response = await fetch(`/api/chat?repoId=${repoId}`, {
    method: 'POST',
    body: JSON.stringify({ message: text }),
  });
  // Handle streaming response
};
```

**FileViewerPage:**
```typescript
const { data: file } = useQuery({
  queryKey: ['file', fileId],
  queryFn: () => api.getFileContent(fileId),
});
```

## 🎯 Key Files to Review

1. **RepositoryOverviewPage.tsx** — Tab interface pattern
2. **FolderStructurePage.tsx** — Two-panel layout pattern
3. **ChatPage.tsx** — Message streaming pattern
4. **FileViewerPage.tsx** — Code viewer with details
5. **FileTree.tsx** — Recursive component pattern
6. **ChatMessage.tsx** — Citation rendering pattern

## ✅ Quality Checklist

- [x] TypeScript strict mode
- [x] All props properly typed
- [x] All components exported
- [x] All routes working
- [x] Responsive design tested
- [x] Dark mode verified
- [x] Accessibility standards met
- [x] No console errors/warnings
- [x] Production build passes
- [x] Bundle size optimized

---

**Phase 2 Status:** ✅ COMPLETE  
**Ready for Phase 3:** API Integration  
**Estimated Time to API Ready:** 2-3 days (depending on API availability)
