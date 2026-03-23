<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. Read the relevant guide in `node_modules/next/dist/docs/` before writing code, and heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent Rules

- Keep this file focused on agent behavior and repo workflow.
- Before changing routes, screens, UX flow, data contracts, design tokens, components, or architecture, read `docs/ARCHITECTURE.md`.
- If you change any of those areas, update `docs/ARCHITECTURE.md` in the same change.
- Keep `docs/ARCHITECTURE.md` architecture-level: include core project tree and key technical decisions; exclude micro UI behavior details.
- Prefer ASCII-only edits in this file.
- Non-conformism: challenge weak, inconsistent, or risky decisions. State the issue, offer a better alternative when one exists, and explain the tradeoff. Do not agree passively with clearly flawed choices.
