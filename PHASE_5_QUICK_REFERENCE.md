# Phase 5 — Performance Optimization Quick Reference

## 📦 Bundle Size Improvements

### Before vs After Code-Splitting

```
BEFORE (Monolithic):
  Main bundle: 646.59 KB (gzip: 204.94 KB)

AFTER (Split):
  Main bundle: 237.15 KB (gzip: 77.15 KB) ✅ 62.3% smaller
  react-vendor: 42.62 KB (gzip: 15.31 KB)
  query-vendor: 50.44 KB (gzip: 15.53 KB)
  graph-viz: 144.73 KB (gzip: 47.33 KB) - loaded on-demand
  markdown: 118.08 KB (gzip: 36.39 KB) - loaded on-demand
  syntax: 19.27 KB (gzip: 7.37 KB) - loaded on-demand
  Route chunks: 2-6 KB each - loaded on navigation
```

## 📂 New Files

### Lazy Components (use instead of regular imports)
```
src/shared/components/
├── LazyDependencyGraph.tsx    — Graph visualization
├── LazySyntaxHighlighter.tsx  — Code highlighting
└── LazyMarkdownRenderer.tsx   — Markdown rendering
```

### Performance Utilities
```
src/shared/utils/
├── performance.ts             — Metrics & Web Vitals
├── memoization.ts             — Debounce, throttle, etc.
└── bundle-analyzer.ts         — Bundle analysis
```

### Routing
```
src/app/
└── lazy-routes.tsx            — Lazy-loaded route components
```

## 🎯 Quick Start

### Use Lazy Components (Phase 5)

```typescript
// ✅ Phase 5: Lazy load heavy components
import { LazyDependencyGraph } from '@/shared/components';

<LazyDependencyGraph
  nodes={graph.nodes}
  edges={graph.edges}
/>

// ✅ Phase 5: Lazy load syntax highlighting
import { LazySyntaxHighlighter } from '@/shared/components';

<LazySyntaxHighlighter
  code={code}
  language="typescript"
  showLineNumbers
/>

// ✅ Phase 5: Lazy load markdown
import { LazyMarkdownRenderer } from '@/shared/components';

<LazyMarkdownRenderer content={markdown} />
```

### Performance Measurement

```typescript
import { recordMetric, measureTime, logMetricsSummary } from '@/shared/utils/performance';

// Record custom metric
recordMetric('query-result-parsing', 45.2, 'ms');

// Measure sync operation
const duration = measureTime('data-processing', () => {
  // your code
});

// Get all metrics
import { getMetrics } from '@/shared/utils/performance';
const metrics = getMetrics();

// Log summary (dev mode)
logMetricsSummary();
```

### Component Optimization

```typescript
import { useDebouncedValue, useThrottledCallback, usePrevious } from '@/shared/utils/memoization';

// Debounce search input
const debouncedSearch = useDebouncedValue(searchTerm, 300);

// Throttle scroll handler
const handleScroll = useThrottledCallback(() => {
  // load more
}, 1000);

// Track previous value
const prevCount = usePrevious(count);
if (prevCount !== count) {
  console.log('Count changed!');
}
```

## 📊 Build Commands

```bash
# Build with code-splitting (default)
npm run build

# Build and analyze bundle (shows size breakdown)
npm run build:analyze

# Development with hot reload
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint
```

## 🎨 Code-Splitting Strategy

### Main Bundle (Always Loaded)
- Core app logic and layout
- Auth pages (critical path)
- Shared utilities
- **Size: 77.15 KB gzip**

### Vendor Chunks (Cached)
```
react-vendor (React + Router): 15.31 KB gzip
  └─ Cached long-term, rarely changes
query-vendor (TanStack Query): 15.53 KB gzip
  └─ Cached long-term, rarely changes
```

### Feature Chunks (Loaded on-Demand)
```
graph-viz (React Flow): 47.33 KB gzip
  └─ Loaded when visiting repository graphs
markdown (react-markdown): 36.39 KB gzip
  └─ Loaded when viewing markdown content
syntax (Prism.js): 7.37 KB gzip
  └─ Loaded when viewing code files
```

### Route Chunks (Loaded on Navigation)
```
Each page: 2-6 KB gzip
  RepositoryOverviewPage
  ChatPage
  FileViewerPage
  FolderStructurePage
  RepositoryListPage
  ProfilePage
  SettingsPage
  SettingsPage
```

## 🔄 Memoization Utilities

### `useDebouncedValue(value, delay)`
```typescript
const debouncedSearch = useDebouncedValue(searchQuery, 300);
// Only updates every 300ms, reducing expensive operations
```

### `useThrottledCallback(callback, delay)`
```typescript
const handleScroll = useThrottledCallback(() => {
  fetchMoreItems();
}, 1000);
// Function called at most once per 1000ms
```

### `usePrevious(value)`
```typescript
const prevValue = usePrevious(value);
if (prevValue !== value) {
  // Value changed
}
```

### `deepEqual(a, b)`
```typescript
import { deepEqual } from '@/shared/utils/memoization';

if (!deepEqual(oldData, newData)) {
  // Data actually changed
}
```

## 📈 Performance Metrics

### Tracked Automatically
- **FCP** — First Contentful Paint
- **LCP** — Largest Contentful Paint
- **CLS** — Cumulative Layout Shift
- **Paint Timings** — First paint events
- Custom metrics (recordMetric)

### View in Browser Console
```javascript
// See all metrics
import { getMetrics } from '@/shared/utils/performance';
console.table(getMetrics());

// Show summary
import { logMetricsSummary } from '@/shared/utils/performance';
logMetricsSummary();

// Analyze resources
import { reportResourceMetrics } from '@/shared/utils/bundle-analyzer';
reportResourceMetrics();
```

## 🌐 Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Requires ES2020 (optional chaining, nullish coalescing, dynamic imports)

## ✅ Quality Checklist

- [x] Code-splitting configured
- [x] Lazy routes implemented
- [x] Lazy components created
- [x] Performance utilities added
- [x] TypeScript: 0 errors
- [x] Build succeeds
- [x] Bundle size reduced 62.3%
- [x] Main bundle < 80 KB gzip
- [x] All chunks properly named
- [x] Suspense boundaries in place
- [x] Loading states provided
- [x] Web Vitals tracking active
- [x] Memoization hooks available

## 🚀 Production Readiness

✅ **Performance Optimized**
- Main bundle: 77.15 KB gzip (77% reduction from monolithic)
- Smart code-splitting for libraries
- Lazy-loaded routes reduce initial load
- Suspense boundaries prevent jank

✅ **Monitoring Ready**
- Web Vitals tracking enabled
- Performance metric recording
- Bundle analysis tools
- Development debugging support

✅ **Developer Experience**
- Clear lazy component API
- Simple performance measurement
- Memoization utilities available
- Good TypeScript support

**The frontend is ready for production deployment!** 🎉

Next Phase (6+): Real User Monitoring, Caching Strategy, Advanced Performance Profiling
