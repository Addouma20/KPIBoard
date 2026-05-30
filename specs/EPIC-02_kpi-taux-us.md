# EPIC-02 — KPI 1 : Taux de réalisation des US par le Workflow

> **Priorité** : P1  
> **Dépend de** : EPIC-01  
> **Objectif** : Calculer le pourcentage d'US réalisées via le workflow automatisé vs celles encore en attente

---

## Définition métier

```
Taux de complétion = (US Done par workflow + US Done manuellement) / Total US du sprint × 100

Taux d'autonomie E2E = US Done par workflow / Total US Done × 100
  (= % des US closes uniquement par l'agent, sans intervention humaine)

Reste à faire = Total US - doneByWorkflow - doneManually
```

Une US est "Done par workflow" si la dernière transition Jira vers un statut `Done` a été effectuée par le **compte de service** du workflow (non par un humain).

> **KPI principal affiché** : Taux d’autonomie E2E (`workflowRatePercent`)
> **KPI secondaire** : Taux de complétion (`completionRatePercent`)

---

## US-02.1 — Calcul du taux de réalisation des US

### Description
En tant que chef de projet,  
je veux voir le pourcentage d'US réalisées par le workflow automatisé,  
afin de mesurer l'efficacité du pipeline CI/CD.

### Critères d'acceptance
- [ ] Le calcul porte sur toutes les US du sprint sélectionné
- [ ] Une US est comptée "Done par workflow" si son dernier auteur de transition vers `Done` est le compte de service
- [ ] Une US est comptée "Done manuellement" si le changement de statut est fait par un humain
- [ ] Les US en statut `To Do`, `In Progress`, `In Review` sont comptées dans "Reste"
- [ ] Le résultat est exprimé en pourcentage avec 1 décimale
- [ ] Le résultat inclut le nombre brut d'US (done_workflow / total)

### Logique de calcul

```typescript
// COPILOT: Créer src/kpi/us-completion-rate.kpi.ts

export interface USCompletionRateResult {
  sprintId: number;
  sprintName: string;
  totalUS: number;
  doneByWorkflow: number;
  doneManualy: number;
  remaining: number;
  completionRatePercent: number;    // % US Done / Total
  workflowRatePercent: number;      // % Done par workflow / Total Done
}

/**
 * COPILOT: Implémenter cette fonction
 * 
 * Règles :
 * 1. Récupérer toutes les issues du sprint (type Story ou Task)
 * 2. Pour chaque issue en statut Done, vérifier le changelog :
 *    - Trouver la transition field="status" toString="Done"
 *    - Si l'auteur === WORKFLOW_SERVICE_ACCOUNT → doneByWorkflow++
 *    - Sinon → doneManually++
 * 3. remaining = totalUS - doneByWorkflow - doneManually
 */
export async function calculateUSCompletionRate(
  sprintId: number,
  workflowServiceAccount: string
): Promise<Result<USCompletionRateResult>>;
```

### Règles de catégorisation des statuts

```typescript
// COPILOT: Créer src/config/workflow-statuses.config.ts

export const DONE_STATUSES = ['Done', 'Closed', 'Resolved', 'Released'];
export const IN_PROGRESS_STATUSES = ['In Progress', 'In Development', 'In Review', 'In QA'];
export const TODO_STATUSES = ['To Do', 'Open', 'Backlog', 'Ready'];

// Ces valeurs doivent être configurables via .env ou fichier de config
// COPILOT: Permettre la surcharge via JIRA_DONE_STATUSES=Done,Closed dans .env
```

---

## US-02.2 — Historique du taux par sprint

### Description
En tant que chef de projet,  
je veux voir l'évolution du taux de réalisation sprint par sprint,  
afin d'identifier les tendances de performance.

### Critères d'acceptance
- [ ] L'historique porte sur les N derniers sprints fermés (N configurable, défaut = 5)
- [ ] Chaque point de donnée contient : sprintName, completionRate, workflowRate, date
- [ ] Les données sont retournées triées par date croissante (pour affichage graphique)
- [ ] Un sprint sans aucune US retourne `null` pour le taux (pas de division par zéro)

### Structure de données

```typescript
// COPILOT: Créer src/kpi/sprint-history.types.ts

export interface SprintKPIPoint {
  sprintId: number;
  sprintName: string;
  endDate: string;
  completionRatePercent: number | null;
  workflowRatePercent: number | null;
  totalUS: number;
  doneUS: number;
}

// COPILOT: Créer src/kpi/sprint-history.service.ts
export async function getSprintHistory(
  boardId: number,
  lastNSprints: number = 5
): Promise<Result<SprintKPIPoint[]>>;
```

---

## US-02.3 — Endpoint REST KPI taux de réalisation

### Description
En tant que développeur frontend,  
je veux un endpoint REST qui retourne le KPI de taux de réalisation,  
afin d'alimenter le dashboard.

### Critères d'acceptance
- [ ] `GET /api/kpi/completion-rate?sprintId=123` retourne `USCompletionRateResult`
- [ ] `GET /api/kpi/completion-rate/history?boardId=42&last=5` retourne `SprintKPIPoint[]`
- [ ] Les erreurs Jira sont relayées avec le bon code HTTP (401, 404, 503)
- [ ] La réponse est mise en cache 5 minutes (TTL configurable)

### Contrat OpenAPI

```yaml
# COPILOT: Ajouter dans src/api/openapi.yaml

/api/kpi/completion-rate:
  get:
    parameters:
      - name: sprintId
        in: query
        required: true
        schema:
          type: integer
    responses:
      200:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/USCompletionRateResult'

/api/kpi/completion-rate/history:
  get:
    parameters:
      - name: boardId
        in: query
        required: true
        schema:
          type: integer
      - name: last
        in: query
        schema:
          type: integer
          default: 5
    responses:
      200:
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: '#/components/schemas/SprintKPIPoint'
```

---

## Tests requis

```typescript
// COPILOT: Créer src/kpi/__tests__/us-completion-rate.test.ts

describe('calculateUSCompletionRate', () => {
  it('retourne 0% si aucune US n\'est Done')
  it('retourne 100% si toutes les US sont Done par le workflow')
  it('distingue correctement Done-workflow vs Done-manuellement')
  it('retourne null pour completionRate si totalUS === 0')
  it('arrondit le pourcentage à 1 décimale')
})
```
