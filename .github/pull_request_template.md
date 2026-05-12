## Description

<!-- Describe the changes in this pull request -->

<!-- Reference any existing issue, drop the section otherwise -->
Relates to #

## Related EPIC

<!-- Which EPIC(s) does this PR address? -->
- [ ] EPIC-01 — Connexion Jira
- [ ] EPIC-02 — KPI Taux US
- [ ] EPIC-03 — KPI Itérations MR
- [ ] EPIC-04 — KPI Lead/Cycle Time
- [ ] EPIC-05 — KPI Bugs par US
- [ ] EPIC-06 — Dashboard UI

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Improvement/Enhancement
- [ ] Refactoring
- [ ] Documentation
- [ ] Breaking change

## Affected Components

<!-- Help reviewers understand scope -->

- KPI modules affected:
- Frontend / Backend / Both:
- Breaking changes (if any):

## Checklist

- [ ] No `any` types introduced
- [ ] `Result<T>` pattern used for all Jira calls
- [ ] Bug/Sub-task exclusion logic respected
- [ ] Env vars validated via Zod (no `process.env` direct access)
- [ ] Alert thresholds remain in `src/kpi/thresholds.config.ts`

## Testing

<!-- Describe how you tested these changes -->

- [ ] Unit tests added/updated (`src/__tests__/`)
- [ ] Integration tests added/updated
- [ ] Manual testing completed
- [ ] Test coverage maintained or improved

**Test Details:**
<!-- Describe specific test scenarios -->

## Reviewer Notes

<!-- Anything reviewers should pay special attention to? -->
<!-- Areas where you'd like specific feedback? -->
