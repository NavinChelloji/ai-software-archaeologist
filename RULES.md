# AI Code Archaeologist — Engineering Rules

These rules apply to all four deployables (`web`, `api`, `indexer`, `ai`) and all modules inside them.

## 1. Code Organization Rules

- Do not put everything in a single file.
- Split code by responsibility: controllers, services, repositories, DTOs, guards, jobs, workers, utilities, and tests.
- Keep files small enough to understand quickly.
- Prefer feature-based folders over generic utility folders.
- Do not mix API routing, business logic, database queries, and external API calls in the same file.
- Keep business logic out of controllers.
- Keep database access inside repository/data-access classes.
- Keep third-party API logic inside provider/client classes.
- Do not duplicate the same logic in multiple modules.
- Create shared helpers only when the logic is truly reusable.
- Avoid over-engineering abstractions before there is real duplication.

## 2. Module Boundary Rules

Because several modules share one deployable, boundaries are enforced by convention rather than by the network. They still hold.

- A module may only be reached through its public service class (`<module>.service.ts`) or its queue handlers. Never import another module's repository, entity, or internal helper.
- A module may only read and write **its own tables**. Cross-module reads go through the owning module's service.
- Every module keeps its own folder, migrations prefix, and tests.
- If a module needs data from a module in a **different deployable**, it uses the internal HTTP client or a queue job — never a direct database connection.
- A module must be extractable into its own deployable by moving its folder and swapping in-process calls for HTTP calls. If that would be hard, the boundary is already broken — fix it.

## 3. Frontend Rules

- Always create reusable React components for repeated UI patterns.
- Keep pages focused on layout and data composition.
- Keep form logic, API logic, and UI rendering separated.
- Use TypeScript types generated from `packages/contracts` for all API requests and responses.
- Use TanStack Query for server state. Use component-local state for UI state.
- Do not add a global state library until there is state that genuinely cannot live in Query or the URL.
- Sanitize Markdown and model-generated content before rendering. Never render raw HTML from model output.
- Never expose GitHub tokens, refresh tokens, or secrets in the browser.
- Add loading, empty, error, and success states for every important screen.
- Ensure the UI works on desktop and mobile.
- Keep graph rendering performant for large repositories: virtualize, cap node counts, and expand on demand.

## 4. Backend Rules

- Every deployable must be independently buildable, deployable, and horizontally scalable.
- Every deployable must be stateless. No durable state in memory or on local disk.
- Durable state goes to the owning database or object storage. Temporary files are deleted after use.
- Each deployable owns its database schema and migrations. No deployable writes to another's database.
- Cross-deployable communication is internal HTTP (synchronous, user-facing) or a pg-boss job (asynchronous, background). Nothing else.
- Every deployable exposes `/health/live` and `/health/ready`.
- All configuration comes from environment variables, validated at startup with `packages/config`.
- Do not hardcode secrets, URLs, credentials, or environment-specific values.
- Use graceful shutdown: stop accepting work, drain in-flight jobs and requests, close pools.

## 5. File Splitting Rules

Default NestJS structure per deployable:

```text
src/
  main.ts
  app.module.ts
  config/
  internal/
    internal-auth.guard.ts
    internal-token.service.ts
  modules/
    module-name/
      module-name.module.ts
      module-name.controller.ts
      module-name.internal.controller.ts
      module-name.service.ts
      module-name.repository.ts
      dto/
      jobs/
      workers/
      tests/
  shared/
    logger/
    errors/
    guards/
    filters/
    interceptors/
    health/
```

Default React structure:

```text
src/
  app/
    routes.tsx
    providers.tsx
  features/
    feature-name/
      components/
      hooks/
      api/
      types/
      pages/
  shared/
    components/
    api/
    hooks/
    utils/
```

## 6. Reusability Rules

- Build reusable UI components for buttons, inputs, modals, tables, graph panels, status badges, and citation cards.
- Build reusable backend utilities for logging, error handling, config validation, queue producers/consumers, and database access — these live in `packages/*`.
- Keep shared packages technical, not business-specific.
- Do not create shared business logic that couples modules together.
- Prefer clear duplication over a bad abstraction when logic is module-specific.
- Do not create a shared package until at least two consumers actually exist.

## 7. Logging Rules

- Add structured JSON logs everywhere.
- Every log includes `service`, `module`, `requestId`, and `correlationId` when available.
- Include `userId`, `repoId`, `snapshotId`, `jobId`, and `conversationId` when relevant.
- Log lifecycle events: sign-in, GitHub connect, repository import, each stage start/finish, processing failure, chat answer created, quota rejection.
- Never log passwords, access tokens, refresh tokens, OAuth codes, GitHub tokens, private keys, or secrets.
- Never log full private source files or chunk content.
- Log errors with useful context, redacting sensitive data.
- Log levels: `debug` local detail, `info` normal business events, `warn` recoverable problems, `error` failed operations needing attention.

## 8. Error Handling Rules

- Do not swallow errors silently.
- Convert unknown errors into typed application errors with a code from `API_ERROR_CODES.md`.
- Return safe messages to users; keep detail in logs.
- Use the single error envelope defined in `packages/contracts` for every API response.
- Include `correlationId` in every error response.
- Retry only safe, idempotent operations. Never retry invalid user input.
- Mark errors `retryable: true|false` explicitly when failing a job.
- Fail fast at startup when required environment variables are missing or malformed.

## 9. Resource Safety Rules

- Avoid memory leaks in workers and React components.
- Close database pools, file handles, streams, HTTP clients, and queue workers on shutdown.
- Clear timers, intervals, subscriptions, and listeners when no longer needed.
- In React, clean up effects that create subscriptions, EventSources, timers, or async work.
- Stream large files; never load an entire repository into memory.
- Enforce the limits in `SCOPE_LIMITS.md`: max repository size, max file size, max file count, processing timeout.
- Avoid unbounded arrays, caches, queues, and recursive traversal. Cap directory recursion depth.
- Paginate every list endpoint.
- Apply backpressure when embedding: bounded concurrency, provider-aware rate limiting.

## 10. Database Rules

- Each deployable has its own `migrations` folder, applied with dbmate.
- Migrations are raw SQL, named `NNN_short_description.sql`.
- Use `uuid` primary keys and `timestamptz` timestamps.
- Add an index for every documented lookup path — including reverse traversals.
- Foreign keys only inside a single database.
- Use transactions for multi-step writes; keep them short.
- Never build SQL through string concatenation. Always use parameterized queries.
- Use `jsonb` for flexible metadata only, never for core searchable fields.
- Set `updated_at` explicitly in the data-access layer, or install one shared trigger function per database — pick one and apply it consistently.
- Every migration must be reviewed for lock impact on tables that will be large (`code_chunks`, `graph_edges`, `repository_files`).

## 11. Queue and Job Rules

- Job names are lowercase and dot-separated, and are declared in `packages/contracts`.
- Every job payload uses the standard envelope and validates against its Zod schema before being enqueued and again on receipt.
- Consumers must be idempotent, using the shared `processed_events` table.
- Duplicate jobs must not create duplicate rows.
- Never put source code, archives, or large blobs in a payload. Send S3 object keys.
- Exhausted jobs go to `<job>.dlq` and raise an alert.
- Do not use the queue for anything a user is waiting on synchronously. Chat is a synchronous streaming path.
- Every stage emits exactly one terminal event; the pipeline advances only on terminal events.
- Workers emit `repo.stage.failed`; only the pipeline module emits `repo.processing.failed`.

## 12. API Rules

- All public routes live under `/api/v1`.
- Validate every request body, query parameter, and path parameter.
- Use DTOs generated from `packages/contracts` for all request and response shapes.
- Publish OpenAPI documentation for public endpoints.
- Authenticate every non-public endpoint.
- Resolve repository ownership at `api` and assert it downstream with the internal service token.
- `/internal/*` routes require a valid internal token and must not be routed from the public ingress.
- Paginate lists with a documented cursor or `page`/`pageSize` scheme.
- Rate-limit auth, import, graph, and chat endpoints.
- Return consistent HTTP status codes and never leak internal errors to the UI.

## 13. Security Rules

- Treat all repository content as untrusted input.
- Never execute imported repository code.
- Never install dependencies from imported repositories.
- Normalize and validate every archive entry path; reject traversal, absolute paths, and escaping symlinks.
- Encrypt GitHub tokens at rest with a versioned key; support rotation.
- Store GitHub tokens in `aca_api` only; hand them to `indexer` just-in-time per job.
- Hash refresh tokens before storing and rotate them on every use.
- Use least-privilege GitHub App permissions.
- Validate JWT signature, expiry, issuer, and audience.
- Protect against CSRF for any cookie-based flow; validate OAuth `state` bound to the browser session.
- Add CORS allowlists in production.
- Sanitize model output before rendering.
- Exclude `.env*`, keys, certificates, and secret-matching files from extraction, chunking, and embedding.
- Redact detected secrets from snippets before sending them to the LLM.
- Run dependency and image scanning in CI. Keep images minimal and patched.

## 14. GitHub Processing Rules

- Verify the user has access to the selected repository before importing.
- Snapshot by commit SHA; store the SHA on every snapshot, graph, symbol, and chunk.
- Prefer the tarball endpoint over `git clone`: no git binary in the image, no `.git` history, far less bandwidth.
- Ignore by default: `.git`, `node_modules`, `dist`, `build`, `out`, `.next`, `.nuxt`, `coverage`, `vendor`, `target`, lockfiles, minified bundles, source maps, binaries, and files matching generated-code markers.
- Skip files above the configured maximum file size and repositories above the configured maximum size.
- Honour GitHub primary **and secondary** rate limits: respect `Retry-After`, back off on abuse-detection responses, and never retry tightly.
- Refresh expiring GitHub tokens before use; treat a refresh failure as "reconnect GitHub", not as a server error.
- Delete temporary extraction directories after processing, including on failure.

## 15. Observability Rules

- Metrics for HTTP latency, error rate, queue depth, job age, stage duration, embedding duration, chat latency, and provider errors.
- Health checks must verify real dependencies, not just return 200.
- Dashboards for service health and pipeline status.
- Alerts for high error rate, DLQ arrivals, stalled jobs, and provider rate-limit failures.
- Propagate `correlationId` and `causationId` across HTTP and queue boundaries even before tracing exists.

## 16. Testing Rules

- Unit tests for business logic, parsers, import resolution, graph builders, chunking, and prompt assembly.
- Integration tests for database repositories and queue handlers.
- Contract tests asserting every job payload matches its schema.
- API tests for public routes, including authorization failures.
- Component tests for important screens.
- End-to-end tests for the main user journey against the checked-in sample repository fixture.
- Test failure paths, not only success paths.
- Test duplicate job delivery.
- Test access to another user's repository.
- Test malformed, oversized, binary, and unresolved-import cases.

## 17. Performance Rules

- Paginate and filter large lists.
- Never return a full graph when a focused graph was requested.
- Enforce graph node limits and neighbourhood expansion.
- Cache expensive read queries in Redis when safe, keyed by `snapshotId` so cutover invalidates naturally.
- Stream large file operations.
- Batch embedding requests and reuse embeddings by content hash across snapshots.
- Run long work as jobs, never inside a request.
- Do not block the event loop with heavy CPU work; parse in worker threads or a separate process.

## 18. Cost Rules

- Every LLM and embedding call records token counts against the requesting user.
- Enforce the per-user quotas in `SCOPE_LIMITS.md` before making a paid call, not after.
- Reuse embeddings across snapshots by `(repo_id, content_hash)`; re-embed only changed content.
- Cap retrieval context size and conversation history.
- Reject oversized repositories at import time with a clear message, not partway through indexing.

## 19. Deployment Rules

- Every deployable has its own Dockerfile and `.env.example`.
- Every deployable builds and deploys independently.
- Run migrations as a separate deployment step; never on production boot.
- Use readiness checks before routing traffic.
- Support horizontal scaling and graceful shutdown.
- Keep production images free of development dependencies.
- Tag images with the commit SHA.

## 20. Configuration Rules

- Validate environment variables at startup and fail fast.
- Keep local, staging, and production config separate.
- Never commit real secrets. Provide safe `.env.example` files.
- Use a secret manager in production.
- Prefer explicit names over generic ones.
- Every documented limit must have a default value written down in `SCOPE_LIMITS.md`.

## 21. Code Quality Rules

- TypeScript strict mode everywhere.
- Avoid `any` unless there is a stated reason.
- Explicit return types on exported functions.
- Keep functions small and focused; avoid deep nesting and hidden side effects.
- Use meaningful names.
- Lint, format, and typecheck in CI.
- Keep comments short and useful. Remove dead code.

## 22. Pull Request Rules

- Explain what changed and why.
- Include tests, or explain why none are needed.
- Include migration notes for database changes.
- Include environment variable changes for config changes.
- Include screenshots for meaningful UI changes.
- Do not mix unrelated refactors with feature work.
- Keep pull requests small enough to review carefully.

## 23. Product Quality Rules

- Build complete user flows, not disconnected screens.
- Add clear empty states and recovery paths.
- Make errors understandable to users.
- Keep private repository data protected.
- Make indexing progress visible and honest — no fake percentages.
- Make graph views useful on real repositories, not only tiny demos.
- Be explicit about limits: unsupported languages, truncated graphs, skipped files.
- Make chat answers practical, with exact files, line ranges, code, and commands when they are supported by evidence.
- Prioritize correctness and trust over flashy output.

## 24. AI and Chat Rules

- Answers must be grounded in retrieved repository context.
- Cite file paths and line ranges for every claim about the code.
- Never invent files, symbols, or commands.
- When evidence is missing, say exactly what is missing and what would help.
- Separate explanation, proposed changes, complete code, and commands.
- Never send excluded or secret-matching files to the LLM.
- Redact detected secrets from snippets before prompt assembly.
- Track token usage and enforce quotas.
- Store prompts and answers only as permitted by `DATA_RETENTION_AND_PRIVACY.md`.
- Prompt templates live in `LLM_PROMPTING.md` and are versioned; a prompt change is a reviewable change.
