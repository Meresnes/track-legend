# Track Legend Architecture

## Documentation Scope
- `docs/ARCHITECTURE.md` must capture only architecture-level information.
- Mandatory content:
  - Current project tree for the core implementation.
  - Route and module boundaries.
  - Key technical decisions and their intent.
  - Data and state strategy.
- Do not include micro-level behavior, UI quirks, or one-off interaction details that do not change architecture or contracts.

## Architectural Style
- The project uses a hybrid `Next.js App Router + layered feature folders` approach.
- `src/app` is the Next.js routing and framework boundary.
- `src/screens`, `src/widgets`, `src/features`, and `src/shared` organize implementation outside the router.
- This is intentionally not strict Feature-Sliced Design:
  - `screens` is used for route-level compositions instead of a formal FSD `pages` layer.
  - The naming favors clarity inside a Next.js App Router codebase over strict adherence to FSD terminology.

## Project Tree (Core Implementation)
```text
src/
  app/
    layout.tsx
    providers.tsx
    page.tsx
    (workspace)/
      layout.tsx
      upload/page.tsx
      sessions/page.tsx
      sessions/[sessionId]/page.tsx
      compare/page.tsx
    api/health/route.ts
    api/openapi.json/route.ts
    api/uploads/route.ts
    api/dev/errors/[status]/route.ts
    docs/api/page.tsx
  screens/
    upload/ui/upload-screen.tsx
    sessions/ui/sessions-screen.tsx
    session-detail/ui/session-detail-screen.tsx
    compare/ui/compare-screen.tsx
  widgets/
    app-shell/ui/app-shell.tsx
    app-shell/ui/app-nav.tsx
  features/
    dev/error-probe/ui/error-probe.tsx
  shared/
    api/client.ts
    api/errors.ts
    ui/placeholder-card.tsx
  server/
    config.ts
    errors.ts
    prisma.ts
    redis.ts
    http/
      health.ts
      uploads.ts
    queues/ingest.ts
    storage/upload-storage.ts
    openapi/
      track-legend.openapi.ts
    worker/
      ingest-worker.ts
      index.ts
```

## App Structure
- Next.js App Router lives in `src/app`.
- Root `/` redirects to `/upload`.
- The workspace shell is under `src/app/(workspace)` and wraps the core product routes with shared navigation and layout.
- Current core routes are `/upload`, `/sessions`, `/sessions/[sessionId]`, and `/compare`.
- Backend route handlers live under `src/app/api`, with `/api/health` and `/api/uploads` as the platform HTTP boundary.
- OpenAPI and backend docs routes are `/api/openapi.json` and `/docs/api`.
- Route-level `error.tsx` and `not-found.tsx` files exist at both the root and workspace levels.
- A small dev-only API route at `src/app/api/dev/errors/[status]/route.ts` is used to exercise error handling.
- `src/app` is reserved for routing, bootstrap, and route handlers; route compositions live in `src/screens`.

## Layered Implementation Areas
- `src/shared` owns reusable UI and infrastructure such as `placeholder-card` and API client/error handling.
- `src/widgets` owns app-shell composition, including the shared navigation chrome.
- `src/features` owns small interactive behaviors such as the dev error probe.
- `src/screens` owns route-level compositions for upload, sessions, session detail, and compare.
- `src/server` owns backend-only runtime code: validated config, dependency clients, storage, queue wiring, HTTP handler logic, and worker bootstrap.
- `src/server/openapi` owns the OpenAPI contract document used by backend docs and API contract tests.
- A dedicated entities/domain layer is intentionally deferred until real session/lap contracts exist.

## Key Technical Decisions
- Use App Router route files only for routing and composition entrypoints; keep screen implementations in `src/screens`.
- Keep Next.js as the single `app` service and expose backend HTTP endpoints through App Router route handlers instead of introducing a separate API service.
- Run BullMQ processing as a separate worker process from `src/server/worker`, but keep it in the same repository and compose stack as the Next app.
- Keep a single app shell (`src/widgets/app-shell`) for cross-route navigation and layout consistency.
- Use a single shared API client and normalized API error shape in `src/shared/api`.
- Use `src/server/http/*` for testable backend request handling and keep `src/app/api/*` thin entrypoints.
- Use a spec-first OpenAPI document as the source of truth for backend HTTP contracts.
- Render interactive API docs with Scalar at `/docs/api`, backed by the local `/api/openapi.json` route.
- Keep `screens` as the route-composition layer to avoid overloading `pages`, which is ambiguous in a Next.js codebase.
- Defer a dedicated domain entity layer until stable telemetry contracts exist to avoid premature abstractions.

## Data And State
- `src/app/providers.tsx` wires TanStack Query and `sonner`.
- `src/shared/api/client.ts` is the single fetch wrapper for API calls.
- `src/shared/api/errors.ts` defines `ApiError` and the global API error notification hook.
- API failures are normalized into `ApiError` and reported through toast notifications.
- Backend runtime configuration is validated in `src/server/config.ts`.
- Prisma connectivity is centralized in `src/server/prisma.ts`; Redis connectivity and BullMQ wiring live in `src/server/redis.ts` and `src/server/queues/ingest.ts`.
- Local raw `.duckdb` uploads are stored through the `src/server/storage/upload-storage.ts` abstraction and shared between app and worker through a mounted volume.
- Public backend contract definitions live in `src/server/openapi/track-legend.openapi.ts` and are exposed verbatim at `/api/openapi.json`.

## Backend Testing
- Backend behavior uses Vitest as the default automated test runner.
- Tests for backend config, storage, API handlers, queue wiring, worker bootstrap, and OpenAPI contract coverage live separately from UI tests under `tests/backend`.

## UI Baseline
- The app uses Tailwind only; there is no external component kit.
- Global theme tokens and typography live in `src/app/globals.css`.
- The design direction is dark-first and telemetry-focused.
- `mainDesign.pen` is the design source of truth for layout and visual decisions.
- Detailed visual guidance lives in `docs/DESIGN_SYSTEM.md`.
