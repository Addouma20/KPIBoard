# EPIC-05 — KPI 4 : Nombre de Bugs par User Story

> **Priorité** : P1  
> **Dépend de** : EPIC-01  
> **Objectif** : Mesurer la qualité des livraisons en comptant les bugs associés à chaque US

---

## Définition métier

```
Bugs par US = Nombre d'issues de type "Bug" liées à une US

Un bug est "lié" à une US si :
  1. Il est lié via "is caused by" / "relates to" dans Jira (issue link)
  2. OU il référence la clé de l'US dans son titre ou sa description
  3. OU il est dans le même sprint ET a le même composant/label que l'US
  4. OU il est un sous-ticket de type Bug enfant de l'US (subtask)

Taux de bugs par US = Total bugs du sprint / Total US Done du sprint
```

### Sévérités à distinguer

| Sévérité | Jira Priority | Poids |
|----------|--------------|-------|
| Bloquant | Blocker / Critical | 3 |
| Majeur | Major / High | 2 |
| Mineur | Minor / Medium / Low | 1 |

---

## US-05.1 — Extraction des bugs liés aux US

### Description
En tant que tech lead,  
je veux connaître le nombre de bugs associés à chaque US,  
afin d'identifier les US qui génèrent le plus de dette qualité.

### Critères d'acceptance
- [ ] Les bugs sont identifiés par `issueType = 'Bug'`
- [ ] La recherche inclut les 4 méthodes de liaison décrites ci-dessus
- [ ] Les doublons (bug lié via plusieurs méthodes) sont dédupliqués par `issueKey`
- [ ] La sévérité de chaque bug est extraite du champ `priority`
- [ ] Le statut du bug est inclus (Open, In Progress, Done) pour distinguer bugs actifs vs résolus
- [ ] Un bug "Done" / "Resolved" après merge ne compte pas dans les bugs actifs

### Logique de calcul

```typescript
// COPILOT: Créer src/kpi/bugs-per-us.kpi.ts

export type BugSeverity = 'blocker' | 'critical' | 'major' | 'minor';
export type BugStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface BugDetail {
  key: string;
  summary: string;
  severity: BugSeverity;
  status: BugStatus;
  createdDate: string;
  resolvedDate: string | null;
  linkedUSKey: string;
  linkMethod: 'issue_link' | 'text_reference' | 'same_sprint_component' | 'subtask';
  weightedScore: number;  // severity weight (Blocker=3, Major=2, Minor=1)
}

export interface USBugResult {
  issueKey: string;
  summary: string;
  totalBugs: number;
  activeBugs: number;         // Open + In Progress
  resolvedBugs: number;
  bugs: BugDetail[];
  weightedBugScore: number;   // Somme des poids de sévérité
  bugsBySeveity: {
    blocker: number;
    critical: number;
    major: number;
    minor: number;
  };
}

export interface SprintBugsResult {
  sprintId: number;
  sprintName: string;
  totalBugs: number;
  totalActiveBugs: number;
  totalResolvedBugs: number;
  bugsPerUSRatio: number | null;      // totalBugs / totalUS
  activeBugsPerUSRatio: number | null;
  
  topBuggyUS: USBugResult[];          // Top 5 US avec le plus de bugs
  severityDistribution: {
    blocker: number;
    critical: number;
    major: number;
    minor: number;
  };
  
  issueDetails: USBugResult[];
}

/**
 * COPILOT: Implémenter getBugsForIssue
 *
 * Algorithme de recherche multi-sources :
 * 1. Jira Issue Links : GET /issue/{issueKey}?fields=issuelinks
 *    → Filtrer links où linkedIssue.fields.issuetype.name === "Bug"
 *
 * 2. Recherche par référence texte :
 *    JQL: issueType = Bug AND (description ~ "{issueKey}" OR summary ~ "{issueKey}")
 *
 * 3. Même sprint + même composant :
 *    JQL: issueType = Bug AND sprint = {sprintId} AND component in ({components})
 *
 * 4. Sous-tâches de type Bug :
 *    GET /issue/{issueKey}?fields=subtasks
 *    → Filtrer subtasks où issuetype.name === "Bug"
 *
 * 5. Dédupliquer par issueKey, prioriser linkMethod dans l'ordre ci-dessus
 */
export async function getBugsForIssue(
  issueKey: string,
  sprintId: number
): Promise<Result<BugDetail[]>>;

export async function calculateSprintBugs(
  sprintId: number
): Promise<Result<SprintBugsResult>>;
```

### Configuration des priorités

```typescript
// COPILOT: Ajouter dans src/config/workflow-statuses.config.ts

export const BUG_SEVERITY_MAP: Record<string, BugSeverity> = {
  'Blocker': 'blocker',
  'Critical': 'critical', 
  'Highest': 'blocker',
  'High': 'critical',
  'Major': 'major',
  'Medium': 'major',
  'Minor': 'minor',
  'Low': 'minor',
  'Lowest': 'minor',
};

export const BUG_SEVERITY_WEIGHTS: Record<BugSeverity, number> = {
  blocker: 3,
  critical: 3,
  major: 2,
  minor: 1,
};

export const BUG_RESOLVED_STATUSES = ['Done', 'Resolved', 'Closed', 'Fixed', "Won't Fix"];
```

---

## US-05.2 — Tendance bugs par sprint

### Description
En tant que chef de projet,  
je veux voir l'évolution du nombre de bugs par sprint,  
afin de suivre la tendance qualité dans le temps.

### Critères d'acceptance
- [ ] L'historique porte sur les N derniers sprints fermés (N configurable, défaut = 5)
- [ ] Chaque point inclut : totalBugs, activeBugs, bugsPerUSRatio, weightedScore
- [ ] Une tendance est calculée (amélioration / dégradation entre dernier et avant-dernier sprint)
- [ ] Les données sont prêtes pour un graphe de tendance (triées par date)

### Structure tendance

```typescript
// COPILOT: Créer src/kpi/bug-trend.types.ts

export interface BugSprintHistoryPoint {
  sprintId: number;
  sprintName: string;
  endDate: string;
  totalBugs: number;
  activeBugs: number;
  bugsPerUSRatio: number | null;
  weightedScore: number;
}

export interface BugTrend {
  history: BugSprintHistoryPoint[];
  trend: 'improving' | 'stable' | 'degrading' | 'insufficient_data';
  trendPercent: number | null;   // variation % entre sprint N-1 et N
}
```

---

## US-05.3 — Endpoint REST KPI Bugs par US

### Critères d'acceptance
- [ ] `GET /api/kpi/bugs?sprintId=123` retourne `SprintBugsResult`
- [ ] `GET /api/kpi/bugs/issue?issueKey=PROJ-42` retourne `USBugResult`
- [ ] `GET /api/kpi/bugs/history?boardId=42&last=5` retourne `BugTrend`
- [ ] Paramètre `?severity=blocker,critical` pour filtrer par sévérité

### Seuils d'alerte

```typescript
// COPILOT: Ajouter dans src/kpi/thresholds.config.ts

export const BUGS_PER_US_THRESHOLDS = {
  excellent: { max: 0.2,      color: '#22c55e', label: '≤ 0.2 bug/US' },
  good:      { max: 0.5,      color: '#84cc16', label: '≤ 0.5 bug/US' },
  warning:   { max: 1.0,      color: '#f59e0b', label: '≤ 1 bug/US' },
  critical:  { max: Infinity, color: '#ef4444', label: '> 1 bug/US' },
};
```

---

## Tests requis

```typescript
// COPILOT: Créer src/kpi/__tests__/bugs-per-us.test.ts

describe('getBugsForIssue', () => {
  it('trouve les bugs via les issue links Jira')
  it('trouve les bugs via référence texte')
  it('déduplique les bugs trouvés par plusieurs méthodes')
  it('distingue bugs actifs et résolus')
  it('mappe correctement les sévérités Jira')
  it('calcule le weightedScore correctement')
})

describe('calculateSprintBugs', () => {
  it('retourne le ratio bugs/US correct')
  it('identifie le Top 5 des US les plus buggées')
  it('retourne null pour bugsPerUSRatio si 0 US Done')
  it('agrège correctement les sévérités')
})
```
