# Track Legend Architecture

## App Structure
- Next.js App Router lives in `src/app`.
- Root `/` redirects to `/upload`.
- The workspace shell is under `src/app/(workspace)` and wraps the core product routes with shared navigation and layout.
- Current core routes are `/upload`, `/sessions`, `/sessions/[sessionId]`, and `/compare`.
- Route-level `error.tsx` and `not-found.tsx` files exist at both the root and workspace levels.
- A small dev-only API route at `src/app/api/dev/errors/[status]/route.ts` is used to exercise error handling.
- `src/app` is reserved for routing, bootstrap, and route handlers; route compositions live in `src/screens`.

## FSD Layers
- `src/shared` owns reusable UI and infrastructure such as `placeholder-card` and API client/error handling.
- `src/widgets` owns app-shell composition, including the shared navigation chrome.
- `src/features` owns small interactive behaviors such as the dev error probe.
- `src/screens` owns route-level compositions for upload, sessions, session detail, and compare.
- Domain entities are intentionally deferred until real session/lap contracts exist.

## Data And State
- `src/app/providers.tsx` wires TanStack Query and `sonner`.
- `src/shared/api/client.ts` is the single fetch wrapper for API calls.
- `src/shared/api/errors.ts` defines `ApiError` and the global API error notification hook.
- API failures are normalized into `ApiError` and reported through toast notifications.

## UI Baseline
- The app uses Tailwind only; there is no external component kit.
- Global theme tokens and typography live in `src/app/globals.css`.
- The design direction is dark-first and telemetry-focused.
- `mainDesign.pen` is the design source of truth for layout and visual decisions.
- Detailed visual guidance lives in `docs/DESIGN_SYSTEM.md`.
