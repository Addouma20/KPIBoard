# EPIC-04 — KPI 3 : Lead Time / Cycle Time par User Story

> **Priorité** : P1  
> **Dépend de** : EPIC-01  
> **Objectif** : Mesurer le temps de traversée d'une US depuis son entrée en workflow jusqu'à sa livraison

---

## Définitions métier

### Lead Time
```
Lead Time = Temps total depuis le démarrage effectif jusqu'à Done

Calcul Jira  : Date transition → "Ready"   jusqu'à Date transition → "Done"
Calcul Git   : Date création branche        jusqu'à Date merge du MR

Unité : heures ouvrées (ou jours, configurable)
```

### Cycle Time
```
Cycle Time = Temps de travail actif (hors attente)

= Temps "In Progress"  +  Temps "In Review"
= Lead Time - Temps en attente (blocages, "On Hold", weekends)

Inclut aussi :
  Temps revue de code = Date PR ouverte → Date review validée (approved)
```

### Schéma de calcul

```
[Ready] ──────────────────────────────────────────────► [Done]
   │                                                        │
   │◄──────────────── LEAD TIME ────────────────────────────►│
   │                                                        
   │  [In Progress] ──► [In Review] ──────────────► [Done]
                              │                       │
                              │◄── TEMPS REVUE CODE ──►│
                              (PR ouverte → approved)
```

---

## US-04.1 — Calcul du Lead Time via transitions Jira

### Description
En tant que tech lead,  
je veux calculer le Lead Time de chaque US depuis les transitions Jira,  
afin de mesurer la vélocité de livraison.

### Critères d'acceptance
- [ ] Le Lead Time est calculé entre la 1ère transition vers un statut "Ready" et la 1ère transition vers "Done"
- [ ] Si l'US repasse par "Ready" → "In Progress" plusieurs fois, on prend le premier "Ready"
- [ ] Le résultat est exprimé en heures (avec conversion en jours ouvrés disponible)
- [ ] Les jours non ouvrés (samedi, dimanche) sont exclus du calcul des jours ouvrés
- [ ] Si l'US n'est pas encore "Done", le Lead Time est calculé jusqu'à `now()` (WIP Lead Time)
- [ ] Une US qui n'a jamais été "Ready" a un Lead Time `null`

### Logique de calcul

```typescript
// COPILOT: Créer src/kpi/lead-cycle-time.kpi.ts

export interface LeadCycleTimeResult {
  issueKey: string;
  summary: string;
  
  // Lead Time
  leadTimeHours: number | null;
  leadTimeBusinessDays: number | null;
  readyDate: string | null;         // ISO 8601
  doneDate: string | null;          // ISO 8601 (null si WIP)
  isWIP: boolean;
  
  // Cycle Time
  cycleTimeHours: number | null;
  activeTimeHours: number | null;   // Temps réel In Progress + In Review
  waitTimeHours: number | null;     // Temps en blocage / On Hold
  
  // Revue de code
  codeReviewTimeHours: number | null;
  prOpenDate: string | null;        // Date entrée en "In Review"
  prApprovedDate: string | null;    // Date sortie de "In Review" vers Done
  
  // Métadonnées
  statusHistory: StatusPeriod[];
}

export interface StatusPeriod {
  status: string;
  startDate: string;
  endDate: string | null;
  durationHours: number | null;
  isBusinessHours: boolean;
}

export interface SprintLeadCycleTimeResult {
  sprintId: number;
  sprintName: string;
  
  leadTime: TimeStats;
  cycleTime: TimeStats;
  codeReviewTime: TimeStats;
  
  issueDetails: LeadCycleTimeResult[];
  wipCount: number;                 // US encore en cours
}

export interface TimeStats {
  averageHours: number | null;
  medianHours: number | null;
  p85Hours: number | null;          // 85e percentile
  minHours: number | null;
  maxHours: number | null;
  sampleSize: number;               // Nombre d'US avec donnée disponible
}

/**
 * COPILOT: Implémenter calculateLeadCycleTime
 *
 * Algorithme :
 * 1. Récupérer le changelog de l'issue (field = "status")
 * 2. Construire le timeline des statuts : [{status, startDate, endDate}]
 * 3. Lead Time = date(premier "Ready") → date(premier "Done")
 * 4. Cycle Time = somme des périodes IN_PROGRESS_STATUSES + REVIEW_STATUSES
 * 5. Code Review Time = somme des périodes REVIEW_STATUSES seulement
 * 6. Wait Time = somme des périodes BLOCKED_STATUSES + ON_HOLD_STATUSES
 * 7. Convertir en jours ouvrés si demandé (exclure weekends)
 */
export async function calculateLeadCycleTime(
  issueKey: string,
  options?: LeadCycleTimeOptions
): Promise<Result<LeadCycleTimeResult>>;

export async function calculateSprintLeadCycleTime(
  sprintId: number,
  options?: LeadCycleTimeOptions
): Promise<Result<SprintLeadCycleTimeResult>>;
```

### Options de configuration

```typescript
// COPILOT: Créer src/kpi/lead-cycle-time.options.ts

export interface LeadCycleTimeOptions {
  businessDaysOnly: boolean;          // défaut: true
  businessHoursStart: number;         // défaut: 9 (9h00)
  businessHoursEnd: number;           // défaut: 18 (18h00)
  timezone: string;                   // défaut: 'Europe/Paris'
  readyStatuses: string[];            // défaut: voir config
  doneStatuses: string[];             // défaut: voir config
  inProgressStatuses: string[];
  reviewStatuses: string[];
  blockedStatuses: string[];
}

// Valeurs par défaut
export const DEFAULT_OPTIONS: LeadCycleTimeOptions = {
  businessDaysOnly: true,
  businessHoursStart: 9,
  businessHoursEnd: 18,
  timezone: 'Europe/Paris',
  readyStatuses: ['Ready', 'Ready for Dev', 'Selected for Development'],
  doneStatuses: ['Done', 'Closed', 'Released'],
  inProgressStatuses: ['In Progress', 'In Development'],
  reviewStatuses: ['In Review', 'Code Review', 'PR Open', 'Peer Review'],
  blockedStatuses: ['Blocked', 'On Hold', 'Waiting'],
};
```

---

## US-04.2 — Calcul du temps de revue de code

### Description
En tant que tech lead,  
je veux mesurer spécifiquement le temps passé en revue de code,  
afin d'identifier si les reviews sont un goulot d'étranglement.

### Critères d'acceptance
- [ ] Le temps de revue = durée cumulée dans les statuts "In Review" / "Code Review"
- [ ] Si l'US passe plusieurs fois par la review (itérations), les durées sont cumulées
- [ ] Le résultat distingue : 1er passage review, passages suivants (re-review après corrections)
- [ ] Le seuil d'alerte est configurable (défaut : > 8h ouvrées = warning)

### Structure complémentaire

```typescript
// COPILOT: Ajouter à LeadCycleTimeResult

export interface CodeReviewDetail {
  reviewRound: number;            // 1ère review, 2ème review...
  startDate: string;
  endDate: string | null;
  durationHours: number | null;
  outcome: 'approved' | 'changes_requested' | 'in_progress';
}

// COPILOT: Ajouter codeReviewDetails: CodeReviewDetail[] dans LeadCycleTimeResult
```

---

## US-04.3 — Endpoint REST KPI Lead/Cycle Time

### Critères d'acceptance
- [ ] `GET /api/kpi/lead-cycle-time?sprintId=123` retourne `SprintLeadCycleTimeResult`
- [ ] `GET /api/kpi/lead-cycle-time/issue?issueKey=PROJ-42` retourne `LeadCycleTimeResult`
- [ ] `GET /api/kpi/lead-cycle-time/history?boardId=42&last=5` retourne l'historique
- [ ] Paramètre `?unit=hours|days` pour choisir l'unité de retour (défaut: hours)

### Seuils d'alerte Lead Time

```typescript
// COPILOT: Ajouter dans src/kpi/thresholds.config.ts

export const LEAD_TIME_THRESHOLDS_BUSINESS_DAYS = {
  excellent: { max: 3,        color: '#22c55e', label: '≤ 3 jours' },
  good:      { max: 5,        color: '#84cc16', label: '≤ 5 jours' },
  warning:   { max: 10,       color: '#f59e0b', label: '≤ 10 jours' },
  critical:  { max: Infinity, color: '#ef4444', label: '> 10 jours' },
};

export const CODE_REVIEW_THRESHOLDS_HOURS = {
  excellent: { max: 4,        color: '#22c55e', label: '≤ 4h' },
  good:      { max: 8,        color: '#84cc16', label: '≤ 8h' },
  warning:   { max: 24,       color: '#f59e0b', label: '≤ 24h' },
  critical:  { max: Infinity, color: '#ef4444', label: '> 24h' },
};
```

---

## Tests requis

```typescript
// COPILOT: Créer src/kpi/__tests__/lead-cycle-time.test.ts

describe('calculateLeadCycleTime', () => {
  it('calcule correctement le Lead Time entre Ready et Done')
  it('exclut les weekends du calcul en jours ouvrés')
  it('retourne isWIP=true si l\'US n\'est pas Done')
  it('calcule le Cycle Time comme somme des périodes actives')
  it('calcule le Code Review Time séparément')
  it('gère les US qui passent plusieurs fois en review')
  it('retourne null si l\'US n\'a jamais été "Ready"')
})

describe('calculateSprintLeadCycleTime', () => {
  it('calcule la médiane et le 85e percentile correctement')
  it('exclut les valeurs null du calcul des stats')
  it('compte correctement les WIP')
})
```
