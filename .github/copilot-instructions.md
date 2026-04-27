# .github/copilot-instructions.md
# Instructions Copilot — Jira KPI Dashboard

## Contexte du projet
Application TypeScript/React de tableau de bord KPI connecté à Jira via MCP Skills.
Lit les sprints et User Stories Jira, calcule 4 KPIs de performance.

## Stack
- Backend : Node.js + TypeScript (strict mode)
- Frontend : React 18 + TailwindCSS + Recharts
- Client Jira : REST API v3 via axios
- Tests : Vitest + React Testing Library
- Build : Vite

## Conventions de code

### TypeScript
- Toujours typer strictement (pas de `any`)
- Utiliser le pattern `Result<T>` pour toutes les fonctions async qui appellent Jira
- Les enums → utiliser `const` objects avec `as const`
- Toujours exporter les interfaces depuis `src/types/`

### Nommage
- Fichiers : `kebab-case.ts`
- Composants React : `PascalCase.tsx`
- Fonctions KPI : `calculate{KPIName}` ou `get{Resource}`
- Tests : `{module}.test.ts` dans `__tests__/`

### Gestion des erreurs Jira
```typescript
// Toujours utiliser ce pattern, jamais throw directement
const result = await jiraClient.getSprints(boardId);
if (!result.success) {
  // gérer result.error
  return;
}
// utiliser result.data
```

### Variables d'environnement
- Toutes lues depuis `.env` via `process.env`
- Validées avec Zod au démarrage
- Jamais hardcodées dans le code

## Structure du projet
```
src/
├── clients/          # JiraClient et abstraction HTTP
├── config/           # Configs (Jira, seuils, statuts workflow)
├── kpi/              # Logique de calcul des 4 KPIs
├── api/              # Routes REST Express
├── components/       # Composants React
│   └── kpi-cards/    # Une carte par KPI
├── types/            # Interfaces TypeScript partagées
└── utils/            # Helpers (dates, export, calculs stats)
```

## Règles métier importantes
1. Les US de type `Bug` et `Sub-task` sont **exclues** du calcul des KPIs
2. Les jours ouvrés = lundi-vendredi, 9h-18h (Europe/Paris), configurable
3. Les seuils d'alerte sont dans `src/kpi/thresholds.config.ts`
4. Le cache API est de 5 minutes (configurable via `CACHE_TTL_SECONDS`)
5. La pagination Jira est gérée automatiquement par le client (max 50 par page)

## Références
- Specs complètes : `specs/` à la racine du projet
- EPIC-01 : Connexion Jira
- EPIC-02 : KPI Taux US
- EPIC-03 : KPI Itérations MR
- EPIC-04 : KPI Lead/Cycle Time
- EPIC-05 : KPI Bugs par US
- EPIC-06 : Dashboard UI
