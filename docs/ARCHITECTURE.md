# Track Legend Architecture

## App Structure
- Next.js App Router lives in `src/app`.
- Root `/` redirects to `/upload`.
- The app shell is under `src/app/(app)` and wraps the core screens with shared navigation and layout.
- Current core routes are `/upload`, `/sessions`, `/sessions/[sessionId]`, and `/compare`.
- Route-level `error.tsx` and `not-found.tsx` files exist at both the root and app-shell levels.
- A small dev-only API route at `src/app/api/dev/errors/[status]/route.ts` is used to exercise error handling.

## Data And State
- `src/app/providers.tsx` wires TanStack Query and `sonner`.
- `src/lib/api/client.ts` is the single fetch wrapper for API calls.
- `src/lib/api/errors.ts` defines `ApiError` and the global API error notification hook.
- API failures are normalized into `ApiError` and reported through toast notifications.

## UI Baseline
- The app uses Tailwind only; there is no external component kit.
- Global theme tokens and typography live in `src/app/globals.css`.
- The design direction is dark-first and telemetry-focused.
- `mainDesign.pen` is the design source of truth for layout and visual decisions.
- Detailed visual guidance lives in `docs/DESIGN_SYSTEM.md`.
