---
applyTo: "src/**/*.ts,src/**/*.tsx,src/**/*.js"
description: "Node.js / TypeScript project conventions for the Jira KPI Dashboard."
name: "KPIBoard Node.js & React Conventions"
---

## Project stack

- **Backend**: Node.js + Express + TypeScript strict mode
- **Frontend**: React 18 + TailwindCSS + Recharts
- **Build**: Vite (frontend) / `ts-node` or compiled JS (backend)
- **Tests**: Vitest + React Testing Library

## Express API conventions

- Routes in `src/api/` — one file per resource (e.g., `kpi.routes.ts`)
- Always validate request params (boardId, sprintId) before calling Jira
- Return `{ success: true, data: ... }` or `{ success: false, error: string }` — mirrors `Result<T>`
- Use `async` handlers wrapped with error middleware; never let unhandled rejections leak

## Vitest test conventions

- Test files: `src/__tests__/{module}.test.ts`
- Mock the Jira client at the module level — never call real Jira in unit tests
- Name test cases descriptively: `it("excludes Bug issues from completion rate", ...)`
- One `describe` block per KPI function

## React + Vite conventions

- Components in `src/components/` — `PascalCase.tsx`
- KPI card components live in `src/components/kpi-cards/`
- Use Recharts for all charts; do not introduce other charting libraries
- Use TailwindCSS utility classes; do not write raw CSS unless unavoidable
- Props interfaces exported from the same file as the component

## General rules

- No `any` — use unknown + type narrowing if the shape is truly unknown
- No hardcoded strings for Jira statuses — use `src/config/workflow-statuses.config.ts`
- All date/time math through `src/utils/business-days.ts` (handles Europe/Paris timezone)

