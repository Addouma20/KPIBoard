# EPIC-06 — Dashboard KPI & Visualisation

> **Priorité** : P2  
> **Dépend de** : EPIC-02, EPIC-03, EPIC-04, EPIC-05  
> **Objectif** : Présenter les 4 KPIs dans une interface claire, actionnable et responsive

---

## US-06.1 — Page principale du Dashboard

### Description
En tant qu'utilisateur,  
je veux voir tous les KPIs sur une seule page avec un sélecteur de sprint,  
afin d'avoir une vue d'ensemble rapide de la performance du projet.

### Critères d'acceptance
- [ ] Un sélecteur de sprint liste les sprints disponibles (actif en premier)
- [ ] Les 4 KPIs s'affichent en cartes avec valeur principale + badge de seuil coloré
- [ ] Le chargement est asynchrone avec skeleton loader par carte
- [ ] Un bouton "Actualiser" force le rechargement (invalidation du cache)
- [ ] La page est responsive (mobile, tablet, desktop)
- [ ] En cas d'erreur Jira, chaque carte affiche son propre message d'erreur

### Structure des composants

```typescript
// COPILOT: Créer src/components/Dashboard.tsx

// Arborescence des composants :
// <Dashboard>
//   <SprintSelector sprints={sprints} onSelect={setSelectedSprint} />
//   <KPIGrid sprintId={selectedSprint.id}>
//     <KPICard kpi="completion-rate" />
//     <KPICard kpi="mr-iterations" />
//     <KPICard kpi="lead-time" />
//     <KPICard kpi="bugs-per-us" />
//   </KPIGrid>
// </Dashboard>

interface KPICardProps {
  kpi: 'completion-rate' | 'mr-iterations' | 'lead-time' | 'bugs-per-us';
  sprintId: number;
  showTrend?: boolean;
  showDetails?: boolean;
}
```

### Layout cible

```
┌─────────────────────────────────────────────────────────────┐
│  🎯 Jira KPI Dashboard          Sprint: [Sprint 2026-Q2 ▼]  │
├──────────────┬──────────────┬──────────────┬────────────────┤
│ ✅ Taux US   │ 🔄 Itérations│ ⏱ Lead Time  │ 🐛 Bugs/US    │
│   78.5%      │    1.4 moy   │   4.2 jours  │   0.3         │
│ ████████░░   │  ●●●●●●░░░░  │  [GOOD]      │  [EXCELLENT]  │
│ 47/60 US     │  Médiane: 1  │  P85: 8j     │  18 bugs / 60 │
├──────────────┴──────────────┴──────────────┴────────────────┤
│  📈 Tendance sur 5 sprints                                   │
│  [Graphe ligne multi-KPI]                                    │
├─────────────────────────────────────────────────────────────┤
│  📋 Détail par US                                [Exporter]  │
│  [Table avec tri/filtre]                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## US-06.2 — Carte KPI : Taux de réalisation

### Description
En tant qu'utilisateur,  
je veux voir le taux de réalisation avec une jauge visuelle,  
afin d'évaluer immédiatement l'avancement du sprint.

### Critères d'acceptance
- [ ] Affiche le pourcentage en grand (ex: `78.5%`)
- [ ] Une barre de progression colorée selon le seuil (vert/orange/rouge)
- [ ] Sous-titre : `47 / 60 US Done` (done / total)
- [ ] Split entre `Done par workflow` et `Done manuellement`
- [ ] Clic ouvre un drawer avec le détail par US

### Composant React

```tsx
// COPILOT: Créer src/components/kpi-cards/CompletionRateCard.tsx

interface CompletionRateCardProps {
  data: USCompletionRateResult | null;
  isLoading: boolean;
  error: string | null;
}

// Utiliser Recharts RadialBarChart ou une barre de progression custom
// Couleurs : 
//   > 80% → #22c55e (vert)
//   60-80% → #f59e0b (orange)
//   < 60% → #ef4444 (rouge)
```

---

## US-06.3 — Carte KPI : Itérations MR

### Description
En tant qu'utilisateur,  
je veux voir la moyenne et la distribution des itérations MR,  
afin d'évaluer la qualité des MR générés.

### Critères d'acceptance
- [ ] Valeur principale : moyenne avec 1 décimale (ex: `1.4`)
- [ ] Mini histogramme de distribution (1x, 2x, 3x+)
- [ ] Badge coloré selon les seuils configurés
- [ ] Médiane affichée en sous-info

### Composant React

```tsx
// COPILOT: Créer src/components/kpi-cards/MRIterationsCard.tsx

// Mini Recharts BarChart pour distribution
// Couleur barre selon seuil (excellent/good/warning/critical)
// Tooltip sur hover avec détail de la distribution
```

---

## US-06.4 — Carte KPI : Lead/Cycle Time

### Description
En tant qu'utilisateur,  
je veux voir le Lead Time et le Cycle Time avec un breakdown des phases,  
afin d'identifier les goulots d'étranglement.

### Critères d'acceptance
- [ ] Valeur principale : Lead Time médian en jours (ex: `4.2j`)
- [ ] Breakdown horizontal : In Progress | In Review | Attente
- [ ] P85 affiché en sous-info (valeur pour 85% des US)
- [ ] Compteur WIP (US encore en cours)
- [ ] Couleur selon seuil Lead Time

### Composant React

```tsx
// COPILOT: Créer src/components/kpi-cards/LeadCycleTimeCard.tsx

// Recharts StackedBarChart horizontal pour le breakdown des phases
// Phases :
//   - In Progress (bleu)
//   - In Review (violet)  
//   - Attente/Bloqué (gris)
// Tooltip avec valeurs absolues en heures
```

---

## US-06.5 — Carte KPI : Bugs par US

### Description
En tant qu'utilisateur,  
je veux voir le ratio bugs/US et la répartition par sévérité,  
afin d'évaluer la qualité de la livraison.

### Critères d'acceptance
- [ ] Valeur principale : ratio bugs/US (ex: `0.3`)
- [ ] Donut chart de répartition sévérité (Blocker/Major/Minor)
- [ ] Compteur bugs actifs vs résolus
- [ ] Badge coloré selon seuil
- [ ] Clic ouvre la liste des US les plus buggées

### Composant React

```tsx
// COPILOT: Créer src/components/kpi-cards/BugsPerUSCard.tsx

// Recharts PieChart (donut) pour la répartition sévérité
// Couleurs sévérité :
//   Blocker → #dc2626 (rouge vif)
//   Critical → #ef4444
//   Major → #f97316 (orange)
//   Minor → #fbbf24 (jaune)
```

---

## US-06.6 — Graphe de tendance multi-sprints

### Description
En tant que chef de projet,  
je veux voir l'évolution des 4 KPIs sur les derniers sprints,  
afin de suivre les tendances de performance.

### Critères d'acceptance
- [ ] Graphe en ligne avec 4 séries (une par KPI)
- [ ] Axe X : noms des sprints
- [ ] Chaque série a son propre axe Y (normalisé 0-100% ou valeur absolue)
- [ ] Toggle pour afficher/masquer chaque série
- [ ] Tooltip groupé sur hover montrant les 4 valeurs

```tsx
// COPILOT: Créer src/components/TrendChart.tsx
// Utiliser Recharts ComposedChart avec LineChart
// Chaque ligne normalisée sur son propre domaine
// Légende interactive (clic toggle la série)
```

---

## US-06.7 — Table de détail par US

### Description
En tant qu'utilisateur,  
je veux voir un tableau de toutes les US du sprint avec leurs KPIs individuels,  
afin de faire un zoom sur les US problématiques.

### Critères d'acceptance
- [ ] Colonnes : Clé US | Titre | Statut | Lead Time | Itérations MR | Bugs | Score qualité
- [ ] Tri par colonne (click header)
- [ ] Filtre par statut
- [ ] Ligne cliquable → ouvre l'US dans Jira (nouvel onglet)
- [ ] Export CSV disponible

### Structure de données

```typescript
// COPILOT: Créer src/components/USDetailTable.tsx

interface USTableRow {
  key: string;
  summary: string;
  status: string;
  leadTimeDays: number | null;
  mrIterations: number | null;
  bugsCount: number;
  activeBugsCount: number;
  qualityScore: number;       // Score composite 0-100
  jiraUrl: string;
}

// Score composite :
// qualityScore = 100
//   - (mrIterations - 1) * 10     // -10 par itération supplémentaire
//   - activeBugsCount * 15        // -15 par bug actif
//   - leadTimeOverrunPenalty      // -X si Lead Time > seuil warning
// min(qualityScore, 0) = 0
```

---

## US-06.8 — Export des données

### Description
En tant qu'utilisateur,  
je veux exporter les KPIs en CSV ou PDF,  
afin de les partager avec les parties prenantes.

### Critères d'acceptance
- [ ] Export CSV de la table de détail par US
- [ ] Export JSON de tous les KPIs du sprint (pour intégration externe)
- [ ] Le nom du fichier inclut le nom du sprint et la date

```typescript
// COPILOT: Créer src/utils/export.utils.ts

export function exportToCSV(rows: USTableRow[], sprintName: string): void;
export function exportToJSON(data: SprintKPIDashboard, sprintName: string): void;

interface SprintKPIDashboard {
  sprint: Sprint;
  exportDate: string;
  completionRate: USCompletionRateResult;
  mrIterations: SprintMRIterationsResult;
  leadCycleTime: SprintLeadCycleTimeResult;
  bugs: SprintBugsResult;
}
```

---

## Tests requis

```typescript
// COPILOT: Créer src/components/__tests__/

// Dashboard.test.tsx
// - Affiche le sélecteur de sprint avec les sprints disponibles
// - Affiche le skeleton loader pendant le chargement
// - Affiche un message d'erreur si Jira est indisponible

// CompletionRateCard.test.tsx
// - Affiche 0% si data.totalUS === 0
// - Applique la bonne couleur selon le seuil
// - Affiche le skeleton si isLoading === true

// TrendChart.test.tsx  
// - Rend correctement avec des données nulles dans la série
// - Toggle correctement les séries au clic
```
