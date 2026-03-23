<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes -- APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:project-preprompt -->
# Track Legend Project Context (Preprompt)

Product: Track Legend
Type: Web app for post-session telemetry analysis (sim racing).
Game focus: Le Mans Ultimate only.
Scope constraints (MVP):
- Post-session analysis only. No real-time HUD.
- File-based upload only (.duckdb).
- Start with 1-2 tracks.
- Single car class.
- Primary telemetry source: .duckdb upload.

Primary user flow:
1. User uploads telemetry file (.duckdb).
2. System processes (queued -> running -> done/error).
3. User opens a session, reviews laps, sets reference lap.
4. User compares two laps, explores charts and corner losses.
5. User reads rule-based insights tied to corners/segments.

Core screens (MVP):
- Upload & ingestion
- Sessions list
- Session detail / laps
- Compare (charts + track map + corner table + insights)

Telemetry data model constraints (do not invent new APIs):
- Compare API provides telemetry traces with shared distance axis.
- Corner metrics API exists.
- Corners have startDistM / endDistM and name.

Compare UX requirements:
- Track Map (always visible) with clickable corner segments.
- Segment click zooms charts to startDistM/endDistM.
- Table row click highlights segment + zooms charts.
- Insights can link to segment focus.
- States: loading, empty, error, no insights.

Design artifacts:
- mainDesign.pen is the current design system and layouts source of truth.

Agent operating rules:
- Always update this AGENTS.md when you introduce or change:
  - routes, screens, or UX flow
  - data contracts or API shapes
  - design tokens, components, or visual system decisions
  - architecture decisions that affect implementation
- Keep updates concise and factual.
- Prefer ASCII only in this file.

Current FE baseline (Sprint 1):
- App Router core flow shell is under app/(app):
  - /upload
  - /sessions
  - /sessions/[sessionId]
  - /compare
- Root route / redirects to /upload.
- UI base: Tailwind-only (no external component kit).
- Providers in app/(app)/layout.tsx:
  - TanStack Query QueryClientProvider
  - sonner Toaster
- Unified API layer:
  - src/lib/api/client.ts (apiClient)
  - src/lib/api/errors.ts (ApiError)
- Error policy:
  - 401/404/500 normalized as ApiError
  - toast notification via global api error handler
  - no automatic redirect on 401
- Route-level boundaries:
  - app/(app)/error.tsx
  - app/(app)/not-found.tsx
- 404 UX:
  - root and app-level not-found include "Back to home" button (href="/")
<!-- END:project-preprompt -->
