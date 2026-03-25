# Track Legend

Track Legend is a Next.js 16 app plus a BullMQ worker for telemetry upload and ingestion.

## Local app

Run the app without Docker:

```bash
pnpm install
pnpm prisma:generate
pnpm dev
```

## Docker stack

The Docker Compose stack now includes a one-shot `migrate` service. `app` and `worker` start only after Prisma migrations have been applied successfully.

Start the full stack:

```bash
docker compose up --build
```

Run only the migration step against the current database volume:

```bash
docker compose up --build migrate
```

The main recovery command for an existing volume with schema drift is:

```bash
docker compose run --rm migrate
```

Use the destructive fallback only for disposable local environments where losing data is acceptable:

```bash
docker compose down -v
docker compose up --build
```

## Prisma operations

Apply migrations outside Docker:

```bash
pnpm prisma:migrate:deploy
```

Generate the Prisma client:

```bash
pnpm prisma:generate
```

## Verification

Backend checks:

```bash
pnpm test:backend
pnpm lint
pnpm build
```

Docker smoke check:

```bash
pnpm smoke:docker
```

The smoke check expects:

- `POST /api/uploads` returns `201` with `status: "queued"`.
- `GET /api/uploads/{uploadId}` reaches `done` with a real `sessionId`.

## Codex Subagents

Project-scoped Codex agents live in `.codex/agents/`.

- `analyst` reviews Jira work before implementation and checks readiness, necessity, dependencies, sequence, and missing inputs.
- Use it before taking a task into active development when you want a go/no-go recommendation and dependency analysis.
- `pencilUX` handles UX/UI implementation through Pencil MCP and .pen updates.
- Scope is visual/layout interaction work only; do not use it for route, contract, or architecture changes.
- `docWriter` updates documentation after coding tasks: project docs, agent usage rules, and architecture notes when needed.
- Scope is architecture-level documentation only: core project tree, route/module boundaries, data/state approach, and key technical decisions.
- Do not use it for micro-level UI behavior notes.

Suggested sequence: `analyst` -> `pencilUX` or main implementation agent -> `docWriter`.
