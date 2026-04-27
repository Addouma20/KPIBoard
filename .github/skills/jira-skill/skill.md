﻿# Jira Skill - Projet CONTRASTE (KPI Dashboard)

## Description

Module PowerShell pour interagir avec l'API Jira REST v2. Gestion des User Stories, commentaires, assignation, transitions de workflow, et **extraction des 4 KPIs** du dashboard.

**Projet cible** : `https://portail.agir.orange.com/projects/CONTRASTE/summary`

## Configuration

Variables d'environnement requises :

```powershell
[Environment]::SetEnvironmentVariable("JIRA_EMAIL", "prenom.nom@sofrecom.com", "User")
[Environment]::SetEnvironmentVariable("JIRA_TOKEN", "votre_token_ici", "User")
# JIRA_URL optionnel — défaut : https://portail.agir.orange.com
# JIRA_PROJECT_KEY optionnel — défaut : CONTRASTE
```

## Chargement

```powershell
. .\.github\skills\jira-skill\script.ps1
Test-JiraConnection
```

## Quick Start — Extraction KPI

```powershell
# 1. Charger le module
. .\.github\skills\jira-skill\script.ps1

# 2. Trouver le board du projet CONTRASTE
$boards = Get-JiraProjectBoards

# 3. Lister les sprints (actifs par défaut)
$sprints = Get-JiraSprints -BoardId $boards[0].id -State active

# 4. Extraire les 4 KPIs d'un sprint
$kpis = Get-JiraSprintKPIData -SprintId $sprints[0].id

# 5. Exporter en JSON (optionnel)
Export-KPIDataToJson -SprintId $sprints[0].id
```

## Fonctions

### Authentification

| Fonction | Description |
|----------|-------------|
| `Test-JiraConnection` | Teste la connexion et affiche l'utilisateur connecté |

### Projet & Sprints (KPI Dashboard)

| Fonction | Paramètres | Description |
|----------|------------|-------------|
| `Get-JiraProjectBoards` | `[-ProjectKey]` | Liste les boards Scrum/Kanban du projet (défaut: CONTRASTE) |
| `Get-JiraSprints` | `-BoardId [-State]` | Liste les sprints (active/closed/future) |
| `Get-JiraSprintIssues` | `-SprintId [-MaxResults]` | Toutes les issues d'un sprint (pagination auto) |
| `Get-JiraSprintUS` | `-SprintId` | User Stories uniquement (exclut Bug, Sub-task) |
| `Get-JiraIssueChangelog` | `-IssueKey` | Historique complet des changements |
| `Get-JiraIssueStatusTransitions` | `-IssueKey` | Transitions de statut extraites du changelog |

### KPI Extraction (specs/)

| Fonction | Paramètres | EPIC | Description |
|----------|------------|------|-------------|
| `Get-KPICompletionRate` | `-SprintId [-DoneStatuses]` | EPIC-02 | Taux de réalisation des US |
| `Get-KPIMRIterations` | `-SprintId [-ReviewStatuses] [-ReworkStatuses]` | EPIC-03 | Itérations MR (allers-retours review) |
| `Get-KPILeadCycleTime` | `-SprintId [-StartStatuses] [-ActiveStatuses] [-DoneStatuses]` | EPIC-04 | Lead Time & Cycle Time par US |
| `Get-KPIBugsPerUS` | `-SprintId` | EPIC-05 | Ratio bugs / US |
| `Get-JiraSprintKPIData` | `-SprintId` | ALL | Calcule les 4 KPIs en une fois |
| `Export-KPIDataToJson` | `-SprintId [-OutputPath]` | ALL | Exporte les 4 KPIs en JSON |

### Issues

| Fonction | Paramètres | Description |
|----------|------------|-------------|
| `Get-JiraIssue` | `-IssueKey` | Détails d'une issue |
| `Search-JiraIssues` | `-JQL [-MaxResults]` | Recherche JQL |
| `Get-MyCurrentIssues` | `[-MaxResults]` | Mes issues actives (hors CLOSED, CANCELLED) |

### Pièces jointes

| Fonction | Paramètres | Description |
|----------|------------|-------------|
| `Get-JiraAttachments` | `-IssueKey` | Liste les pièces jointes d'une issue (métadonnées : id, nom, taille, URL) |
| `Get-JiraAttachmentContent` | `-AttachmentUrl -Filename [-SavePath]` | Télécharge le contenu d'une pièce jointe. Retourne le texte pour les fichiers texte/code (`.java`, `.xml`, `.json`, `.sql`, `.drl`, etc.) ou le chemin de sauvegarde pour les fichiers binaires |

### Commentaires

| Fonction | Paramètres | Description |
|----------|------------|-------------|
| `Get-JiraComments` | `-IssueKey` | Liste les commentaires |
| `Add-JiraComment` | `-IssueKey -Comment` | Ajoute un commentaire |

### Assignation

| Fonction | Paramètres | Description |
|----------|------------|-------------|
| `Assign-JiraIssueToMe` | `-IssueKey` | S'auto-assigne l'issue |
| `Set-JiraIssueAssignee` | `-IssueKey -Username` | Assigne à un utilisateur |

### Transitions

| Fonction | Paramètres | Description |
|----------|------------|-------------|
| `Get-JiraTransitions` | `-IssueKey` | Liste les transitions disponibles |
| `Invoke-JiraTransitionByName` | `-IssueKey -StatusName` | Transition par nom de statut |
| `Set-JiraStatusAnalysing` | `-IssueKey` | → ANALYSING |
| `Set-JiraStatusReadyForRefinement` | `-IssueKey` | → READY FOR REFINEMENT |
| `Set-JiraStatusReadyForDev` | `-IssueKey` | → READY FOR DEV |
| `Set-JiraStatusOnHold` | `-IssueKey` | → ON HOLD |
| `Set-JiraStatusInProgress` | `-IssueKey` | → IN PROGRESS |
| `Set-JiraStatusInReview` | `-IssueKey` | → IN REVIEW |
| `Set-JiraStatusReadyForTest` | `-IssueKey` | → READY FOR TEST |
| `Set-JiraStatusTestInProgress` | `-IssueKey` | → TEST IN PROGRESS |
| `Set-JiraStatusReadyForDelivery` | `-IssueKey` | → READY FOR DELIVERY |
| `Set-JiraStatusClosed` | `-IssueKey` | → CLOSED |
| `Set-JiraStatusCancelled` | `-IssueKey` | → CANCELLED (depuis n'importe quel statut) |
| `Set-JiraStatusReopened` | `-IssueKey` | → REOPENED |

## Alias

```
jira-test     → Test-JiraConnection
jira-issue    → Get-JiraIssue
jira-search   → Search-JiraIssues
jira-mine     → Get-MyCurrentIssues
jira-boards   → Get-JiraProjectBoards
jira-sprints  → Get-JiraSprints
jira-kpis     → Get-JiraSprintKPIData
```

## Mapping KPI ↔ Specs

| KPI | Fonction | Spec |
|-----|----------|------|
| Taux de réalisation US | `Get-KPICompletionRate` | `specs/EPIC-02_kpi-taux-us.md` |
| Itérations MR | `Get-KPIMRIterations` | `specs/EPIC-03_kpi-iterations-mr.md` |
| Lead / Cycle Time | `Get-KPILeadCycleTime` | `specs/EPIC-04_kpi-lead-cycle-time.md` |
| Bugs par US | `Get-KPIBugsPerUS` | `specs/EPIC-05_kpi-bugs-par-us.md` |
| Dashboard UI | — (consomme les 4 KPIs) | `specs/EPIC-06_dashboard-ui.md` |

## Workflow Jira CONTRASTE

```
DRAFT ──────────────────────────────────────────── CANCELLED (depuis ALL)
   ↓                                                        ↑
ANALYSING                                                   │
   ↓                                                        │
READY FOR REFINEMENT                                        │
   ↓                                                        │
READY FOR DEV ◄── retour (review KO / tests KO)            │
   ↕ ON HOLD                                                │
IN PROGRESS ────────────────────────────────────────────────┤
   ↓                                                        │
IN REVIEW ──► READY FOR DEV (review KO) ────────────────────┤
   ↓                                                        │
READY FOR TEST                                              │
   ↓                                                        │
TEST IN PROGRESS ──► READY FOR DEV (tests KO) ──────────────┤
   ↓                                                        │
READY FOR DELIVERY ◄──► CLOSED                              │
                                                            │
REOPENED ──► READY FOR DEV ─────────────────────────────────┘
```

| De | Vers | Fonction |
|----|------|----------|
| DRAFT | ANALYSING | `Set-JiraStatusAnalysing` |
| DRAFT / ANALYSING | READY FOR REFINEMENT | `Set-JiraStatusReadyForRefinement` |
| ANALYSING / READY FOR REFINEMENT | READY FOR DEV | `Set-JiraStatusReadyForDev` |
| READY FOR DEV | ON HOLD | `Set-JiraStatusOnHold` |
| ON HOLD / READY FOR DEV | IN PROGRESS | `Set-JiraStatusInProgress` |
| IN PROGRESS | IN REVIEW | `Set-JiraStatusInReview` |
| IN REVIEW | READY FOR DEV | `Set-JiraStatusReadyForDev` |
| IN REVIEW | READY FOR TEST | `Set-JiraStatusReadyForTest` |
| READY FOR TEST | TEST IN PROGRESS | `Set-JiraStatusTestInProgress` |
| TEST IN PROGRESS | READY FOR DEV | `Set-JiraStatusReadyForDev` |
| TEST IN PROGRESS | READY FOR DELIVERY | `Set-JiraStatusReadyForDelivery` |
| READY FOR DELIVERY | CLOSED | `Set-JiraStatusClosed` |
| CLOSED | READY FOR DELIVERY | `Set-JiraStatusReadyForDelivery` |
| CLOSED / ANY | REOPENED | `Set-JiraStatusReopened` |
| REOPENED | READY FOR DEV | `Set-JiraStatusReadyForDev` |
| **ALL** | CANCELLED | `Set-JiraStatusCancelled` |

> `Invoke-JiraTransitionByName` résout automatiquement l'ID via l'API — les fonctions `Set-JiraStatusXxx` l'utilisent en interne.

## Dépannage

| Erreur | Cause | Solution |
|--------|-------|----------|
| `Configuration Jira manquante` | Variables env absentes | Définir `JIRA_EMAIL` et `JIRA_TOKEN`, redémarrer PowerShell |
| `401 Unauthorized` | Token expiré ou invalide | Régénérer le token dans Jira > Profil > Tokens API |
| `404 Not Found` | Clé issue incorrecte | Vérifier la clé et les permissions |

---

**Version** : 3.0 | **Projet** : CONTRASTE