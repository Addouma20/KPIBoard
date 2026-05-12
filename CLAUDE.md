# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (run both concurrently)
npm run dev           # Frontend on :5173, proxies /api to :3001
npm run dev:server    # Backend on :3001 with hot-reload (tsx watch)

# Build & type-check
npm run build         # tsc --noEmit + vite build
npm run typecheck     # tsc --noEmit only

# Tests
npm test              # vitest run (all tests)
npm run test:watch    # vitest watch mode
# Run a single test file:
npx vitest run src/__tests__/completion-rate.test.ts
```

## Architecture

Full-stack TypeScript monorepo with a shared `src/` directory:

- **Frontend**: React 19 + Vite + TailwindCSS 4 + Recharts. Entry: `src/main.tsx`. Vite proxies `/api` requests to the Express backend.
- **Backend**: Express on port 3001. Entry: `src/server.ts`. Routes in `src/api/`.
- **Jira client**: `src/clients/JiraClient.ts` — Axios-based, handles pagination (50/page), in-memory cache (default 5 min TTL), and HTTPS with `rejectUnauthorized: false` for the Orange Jira instance.

### Request flow

```
Browser → Vite dev server (:5173)
       → /api/* proxied to Express (:3001)
       → Route handlers (src/api/)
       → KPI calculation functions (src/kpi/)
       → JiraClient (src/clients/)
       → Jira REST API v3
```

### KPI modules (`src/kpi/`)

Each EPIC maps to a calculation module:

| EPIC    | Module                     | What it measures                                      |
|---------|----------------------------|-------------------------------------------------------|
| EPIC-02 | `completion-rate.ts`       | % of User Stories closed by workflow bot vs manually  |
| EPIC-03 | `mr-iterations.ts`         | Average code review iterations per issue              |
| EPIC-04 | `lead-cycle-time.ts`       | Lead time / cycle time in business hours              |
| EPIC-05 | `bugs-per-us.ts`           | Bug-to-story ratio with severity weighting            |

Additional derived modules: `kanban-kpi.ts`, `ai-comparison.ts`, `insights.ts`, `roi.ts`, `historical-trends.ts`, `developer-ranking.ts`.

### Key patterns

**Result\<T\>** — all async Jira calls return `Result<T>` (never throw):
```typescript
const result = await jiraClient.getSprints(boardId);
if (!result.success) { /* handle result.error */ return; }
// use result.data
```

**Business rules**:
- `Bug` and `Sub-task` issue types are excluded from KPI calculations.
- Business hours = Mon–Fri, 09:00–18:00 Europe/Paris (configurable).
- Only issues matching `isUserStory` predicate are counted.
- Workflow-bot transitions vs manual transitions are tracked separately (`WORKFLOW_SERVICE_ACCOUNT` env var).

**Configuration** (`src/config/`): All env vars validated with Zod at startup. Never hardcode values — add to `.env` and reference via `process.env`.

**Thresholds**: Alert levels (excellent / good / warning / critical) defined in `src/kpi/thresholds.config.ts`.

## Environment variables

Key vars (see `.env.example` or `src/config/jira.config.ts` for full list):

```
JIRA_URL                   # default: https://portail.agir.orange.com
JIRA_EMAIL
JIRA_TOKEN
JIRA_PROJECT_KEY           # default: CONTRASTE
JIRA_ITERATIONS_FIELD      # default: customfield_10020
CACHE_TTL_SECONDS          # default: 300
PORT                       # default: 3001
WORKFLOW_SERVICE_ACCOUNT   # default: workflow-bot
AI_AGENT_MARKERS           # comma-separated markers for AI-generated code detection
JIRA_DONE_STATUSES         # comma-separated, case-insensitive
JIRA_IN_PROGRESS_STATUSES
```

## Naming conventions

- Files: `kebab-case.ts` / `kebab-case.tsx`
- React components: `PascalCase.tsx`
- KPI functions: `calculate{KPIName}` or `get{Resource}`
- Tests: `src/__tests__/{module}.test.ts`
- TypeScript enums: `const` objects with `as const` (no `enum` keyword)
- All shared interfaces exported from `src/types/`

## Specs

Full KPI specifications in `specs/` at project root (EPIC-01 through EPIC-06).
