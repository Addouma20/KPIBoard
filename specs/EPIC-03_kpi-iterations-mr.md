# EPIC-03 — KPI 2 : Nombre d'itérations avant acceptation du Merge Request

> **Priorité** : P1  
> **Dépend de** : EPIC-01  
> **Objectif** : Mesurer combien de cycles review/correction sont nécessaires avant qu'un MR proposé par le workflow soit accepté

---

## Définition métier

```
Itération MR = Un cycle : [workflow ouvre MR] → [reviewer demande des changes] → [workflow corrige]

Nombre d'itérations = Nombre de fois où le reviewer a demandé des modifications
                      avant l'approbation finale du MR

Idéalement = 1 (approbation directe)
Mauvais signal = > 3 (qualité du code généré par le workflow insuffisante)
```

### Source de données prioritaire

| Source | Champ Jira | Description |
|--------|-----------|-------------|
| **Primaire** | Champ custom configurable (`customfield_iterations`) | Lu en premier ; si présent, les transitions sont ignorées |
| **Secondaire** | Transitions changelog : `In Review → Changes Requested` ou `In Review → In Progress` | Comptage des allers-retours si le champ custom est absent |
| **Unavailable** | Aucune activité de review détectée dans le changelog | `iterationsCount = null` (non compté dans les stats) |

---

## US-03.1 — Extraction du nombre d'itérations MR depuis Jira

### Description
En tant que tech lead,  
je veux que l'application extraie le nombre de cycles de review par US,  
afin de mesurer la qualité des MR générés par le workflow.

### Critères d'acceptance
- [ ] L'extraction tente d'abord le champ custom Jira `customfield_iterations` (configurable)
- [ ] En fallback, l'extraction compte les transitions `In Review → Changes Requested`
- [ ] En fallback secondaire, l'extraction compte les transitions `In Review → In Progress` (retour en développement)
- [ ] Si aucune donnée disponible, la valeur est `null` (pas `0`)
- [ ] Une itération = 1 aller-retour (demande de modification reçue)
- [ ] `iterationsCount = reviewTransitions.length + 1` si des retours ont été détectés (`1` si review directe, `N` si N-1 allers-retours)
- [ ] Le **Taux d'Approbation 1er passage** (First-Time Right) = `oneIteration / (oneIteration + twoIterations + threeOrMore) × 100` (exclut les US sans données de review)
- [ ] L'**Indice de Rework** = Moyenne des `(iterationsCount - 1)` par US avec données de review

### Logique de calcul

```typescript
// COPILOT: Créer src/kpi/mr-iterations.kpi.ts

export interface MRIterationsResult {
  issueKey: string;
  iterationsCount: number | null;
  dataSource: 'custom_field' | 'status_transitions' | 'unavailable';
  reviewTransitions: ReviewTransition[];
}

export interface ReviewTransition {
  from: string;
  to: string;
  date: string;
  author: string;
}

export interface SprintMRIterationsResult {
  sprintId: number;
  sprintName: string;
  averageIterations: number | null;
  medianIterations: number | null;
  maxIterations: number | null;
  distribution: IterationDistribution;
  issueDetails: MRIterationsResult[];
}

export interface IterationDistribution {
  oneIteration: number;       // MRs acceptés du premier coup
  twoIterations: number;
  threeOrMore: number;
  unavailable: number;
}

/**
 * COPILOT: Implémenter cette fonction
 *
 * Algorithme de comptage par transitions :
 * 1. Récupérer le changelog de l'issue (champ "status")
 * 2. Filtrer les transitions pertinentes pour la review
 * 3. Compter les retours en arrière depuis "In Review"
 * 4. Chaque retour = 1 itération supplémentaire
 * 
 * Transitions indiquant une itération :
 * - "In Review" → "Changes Requested"
 * - "In Review" → "In Progress"  
 * - "Code Review" → "Rework"
 */
export async function calculateMRIterations(
  issueKey: string
): Promise<Result<MRIterationsResult>>;

export async function calculateSprintMRIterations(
  sprintId: number
): Promise<Result<SprintMRIterationsResult>>;
```

### Configuration des statuts de review

```typescript
// COPILOT: Ajouter dans src/config/workflow-statuses.config.ts

export const REVIEW_STATUSES = {
  inReview: ['In Review', 'Code Review', 'Peer Review'],
  changesRequested: ['Changes Requested', 'Rework', 'Request Changes'],
  approved: ['Approved', 'Ready to Merge', 'Merge Ready'],
  customIterationsField: process.env.JIRA_ITERATIONS_FIELD ?? 'customfield_10020',
};
```

---

## US-03.2 — Agrégation des itérations par sprint

### Description
En tant que chef de projet,  
je veux la moyenne et la distribution des itérations par sprint,  
afin d'identifier si la qualité du workflow s'améliore.

### Critères d'acceptance
- [ ] Le KPI retourne : moyenne, médiane, maximum des itérations
- [ ] La distribution détaille combien d'US ont eu 1, 2, ou 3+ itérations
- [ ] Les US sans données sont comptées séparément (non dans la moyenne)
- [ ] L'historique sur N sprints est disponible pour un graphe de tendance

### Seuils d'alerte

```typescript
// COPILOT: Créer src/kpi/thresholds.config.ts

// Seuils pour l'Indice de Rework (allers-retours moyens, 0 = meilleur)
export const MR_ITERATIONS_THRESHOLDS = {
  excellent: { max: 0.2,      color: '#22c55e', label: 'Excellent' },
  good:      { max: 0.8,      color: '#84cc16', label: 'Bon' },
  warning:   { max: 1.5,      color: '#f59e0b', label: 'A surveiller' },
  critical:  { max: Infinity, color: '#ef4444', label: 'Critique' },
};

// Seuils pour le Taux d'Approbation 1er passage (% plus élevé = meilleur)
export const FIRST_TIME_RIGHT_THRESHOLDS = {
  excellent: { min: 80, color: '#22c55e', label: '>= 80%' },
  good:      { min: 60, color: '#84cc16', label: '>= 60%' },
  warning:   { min: 40, color: '#f59e0b', label: '>= 40%' },
  critical:  { min: 0,  color: '#ef4444', label: '< 40%' },
};

// COPILOT: Créer une fonction getThreshold(value: number) qui retourne le bon seuil
```

---

## US-03.3 — Endpoint REST KPI itérations MR

### Description
En tant que développeur frontend,  
je veux un endpoint REST pour les itérations MR,  
afin d'alimenter le dashboard.

### Critères d'acceptance
- [ ] `GET /api/kpi/mr-iterations?sprintId=123` retourne `SprintMRIterationsResult`
- [ ] `GET /api/kpi/mr-iterations/issue?issueKey=PROJ-42` retourne `MRIterationsResult`
- [ ] `GET /api/kpi/mr-iterations/history?boardId=42&last=5` retourne l'historique

### Contrat de réponse

```typescript
// COPILOT: Exemple de réponse attendue pour GET /api/kpi/mr-iterations?sprintId=123
const exampleResponse: SprintMRIterationsResult = {
  sprintId: 123,
  sprintName: "Sprint 2026-Q2-W1",
  averageIterations: 1.4,
  medianIterations: 1,
  maxIterations: 4,
  distribution: {
    oneIteration: 12,
    twoIterations: 5,
    threeOrMore: 2,
    unavailable: 1,
  },
  issueDetails: [
    {
      issueKey: "PROJ-42",
      iterationsCount: 2,
      dataSource: "status_transitions",
      reviewTransitions: [
        { from: "In Review", to: "Changes Requested", date: "2026-04-10T14:30:00Z", author: "reviewer@company.com" },
        { from: "In Progress", to: "In Review", date: "2026-04-11T09:00:00Z", author: "workflow-bot" },
        { from: "In Review", to: "Done", date: "2026-04-11T16:00:00Z", author: "reviewer@company.com" },
      ]
    }
  ]
};
```

---

## Tests requis

```typescript
// COPILOT: Créer src/kpi/__tests__/mr-iterations.test.ts

describe('calculateMRIterations', () => {
  it('retourne 1 si le MR est accepté sans aller-retour')
  it('compte correctement les transitions Changes Requested')
  it('priorise le champ custom_field sur les transitions')
  it('retourne null si aucune donnée disponible')
  it('ignore les transitions non liées à la review')
})

describe('calculateSprintMRIterations', () => {
  it('calcule correctement la moyenne en ignorant les null')
  it('calcule la médiane correctement')
  it('distribue correctement 1/2/3+ itérations')
})
```
