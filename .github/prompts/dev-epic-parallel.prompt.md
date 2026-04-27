# Developper les EPICs KPI en parallele

---
description: Lance le developpement de toutes les US des specs/ en parallele via subagents
mode: agent
---

Tu es le chef d'orchestre du projet **Jira KPI Dashboard**.
Ton role : lancer le developpement de chaque EPIC depuis `specs/` en parallele.

## Contexte projet

- Stack : TypeScript strict, React 18, TailwindCSS, Recharts, Vite, Vitest
- Conventions : voir `.github/copilot-instructions.md`
- Specs : chaque fichier `specs/EPIC-XX_*.md` contient les US a implementer
- Skill Jira : `.github/skills/jira-skill/script.ps1` fournit les fonctions d'extraction

## Regles imperatives

1. **Exclure Bug et Sub-task** des calculs KPI
2. **Pattern Result<T>** pour toutes les fonctions async Jira (jamais throw)
3. **Typage strict** : pas de `any`, interfaces dans `src/types/`
4. **Nommage** : fichiers `kebab-case.ts`, composants `PascalCase.tsx`, fonctions `calculate{KPI}`
5. **Tests** : chaque module KPI a son `__tests__/{module}.test.ts` avec Vitest
6. **Config** : variables d'env validees avec Zod, seuils dans `src/kpi/thresholds.config.ts`

## Structure cible

```
src/
  types/              # Interfaces partagees (Result<T>, JiraTypes, KPITypes)
  clients/            # JiraClient REST API v3 via axios + cache 5min
  config/             # jira.config.ts, workflow-statuses.config.ts, thresholds.config.ts
  kpi/
    us-completion-rate.kpi.ts       # EPIC-02
    mr-iterations.kpi.ts            # EPIC-03
    lead-cycle-time.kpi.ts          # EPIC-04
    bugs-per-us.kpi.ts              # EPIC-05
    thresholds.config.ts
  api/                # Routes Express
  components/
    Dashboard.tsx                   # EPIC-06
    SprintSelector.tsx
    KPIGrid.tsx
    kpi-cards/
      CompletionRateCard.tsx
      MRIterationsCard.tsx
      LeadCycleTimeCard.tsx
      BugsPerUSCard.tsx
  utils/              # dates (jours ouvres), stats (mediane, percentile), export
  __tests__/
```

## Plan d'execution parallele

### Vague 1 -- Fondations (sequentiel)

Creer d'abord les fichiers partages dont tous les EPICs dependent :

1. `src/types/result.types.ts` -- pattern Result<T> + error types
2. `src/types/jira.types.ts` -- JiraIssue, JiraSprint, JiraChangelog, JiraTransition
3. `src/types/kpi.types.ts` -- interfaces de sortie des 4 KPIs (depuis les specs)
4. `src/clients/jira-client.ts` -- JiraClient avec auth, pagination auto, cache TTL
5. `src/config/jira.config.ts` -- validation Zod des env vars
6. `src/config/workflow-statuses.config.ts` -- statuts Done/InProgress/Todo configurables
7. `src/utils/business-days.ts` -- calcul jours/heures ouvres (lun-ven, 9h-18h, Europe/Paris)
8. `src/utils/stats.ts` -- moyenne, mediane, percentile, distribution

### Vague 2 -- KPIs (parallele, 4 agents)

Lancer **en parallele** via subagents :

**Agent EPIC-02** : Lire `specs/EPIC-02_kpi-taux-us.md` puis implementer :
- `src/kpi/us-completion-rate.kpi.ts` (calculateUSCompletionRate, calculateSprintHistory)
- `src/__tests__/us-completion-rate.test.ts`

**Agent EPIC-03** : Lire `specs/EPIC-03_kpi-iterations-mr.md` puis implementer :
- `src/kpi/mr-iterations.kpi.ts` (calculateMRIterations, calculateSprintMRIterations)
- `src/__tests__/mr-iterations.test.ts`

**Agent EPIC-04** : Lire `specs/EPIC-04_kpi-lead-cycle-time.md` puis implementer :
- `src/kpi/lead-cycle-time.kpi.ts` (calculateLeadTime, calculateCycleTime, calculateSprintLeadCycleTime)
- `src/__tests__/lead-cycle-time.test.ts`

**Agent EPIC-05** : Lire `specs/EPIC-05_kpi-bugs-par-us.md` puis implementer :
- `src/kpi/bugs-per-us.kpi.ts` (calculateBugsPerUS, calculateSprintBugsPerUS)
- `src/__tests__/bugs-per-us.test.ts`

### Vague 3 -- Seuils + API (sequentiel)

- `src/kpi/thresholds.config.ts` -- seuils vert/orange/rouge pour chaque KPI
- `src/api/kpi.routes.ts` -- endpoints REST pour chaque KPI + endpoint agrege

### Vague 4 -- Dashboard UI (parallele, agents par composant)

Lancer apres les vagues 1-3. Lire `specs/EPIC-06_dashboard-ui.md` puis :

**Agent UI-Core** :
- `src/components/Dashboard.tsx`
- `src/components/SprintSelector.tsx`
- `src/components/KPIGrid.tsx`

**Agent UI-Cards** (parallele) :
- `src/components/kpi-cards/CompletionRateCard.tsx`
- `src/components/kpi-cards/MRIterationsCard.tsx`
- `src/components/kpi-cards/LeadCycleTimeCard.tsx`
- `src/components/kpi-cards/BugsPerUSCard.tsx`

## Instructions pour chaque subagent

Chaque agent doit :
1. Lire le fichier spec EPIC correspondant dans `specs/`
2. Lire les types partages dans `src/types/`
3. Implementer le code en respectant les conventions `.github/copilot-instructions.md`
4. Creer les tests unitaires avec des mocks Jira
5. Verifier qu'il n'y a pas d'erreurs TypeScript

## Execution

Lance l'execution vague par vague. Commence par la Vague 1, puis lance les 4 agents KPI en parallele (Vague 2), puis Vague 3, puis Vague 4.
