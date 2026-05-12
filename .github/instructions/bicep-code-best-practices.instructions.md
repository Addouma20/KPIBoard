---
description: 'Jira Client and KPI calculation patterns for KPIBoard'
applyTo: 'src/clients/**/*.ts,src/kpi/**/*.ts,src/api/**/*.ts'
---

# Jira Client & KPI Patterns — KPI Dashboard

## Result<T> Pattern — mandatory for all Jira calls

Never `throw` from async Jira functions. Always return `Result<T>` from `src/types/result.types.ts`:

```typescript
const result = await jiraClient.getSprints(boardId);
if (!result.success) {
  // handle result.error — do NOT throw
  return;
}
// safe to use result.data
```

## JiraClient conventions

- Single instance via `src/clients/jira-client.ts`
- Auth: Bearer token from `JIRA_API_TOKEN` env var (never hardcode)
- Base URL: `JIRA_BASE_URL/rest/api/3/`
- Pagination: automatic, 50 items per page, merge all pages before returning
- Cache: 5-minute TTL, configurable via `CACHE_TTL_SECONDS`

## Business rules — filtering

- **Always exclude** `Bug` and `Sub-task` issue types from KPI calculations
- JQL pattern: `project = {KEY} AND sprint = {ID} AND issuetype not in (Bug, Sub-task)`
- Working hours: Mon–Fri, 09:00–18:00 Europe/Paris → use `src/utils/business-days.ts`

## KPI function signatures

```typescript
// Standard shape for all KPI calculators
export async function calculate{KPIName}(
  boardId: number,
  sprintId: number,
): Promise<Result<{KPI}Result>> { ... }
```

## Alert thresholds

All green/orange/red thresholds live in `src/kpi/thresholds.config.ts`.
Never inline numeric thresholds in KPI logic.

## Environment variables

All Jira env vars validated with Zod at startup in `src/config/jira.config.ts`.
Never call `process.env` directly outside the config module.
