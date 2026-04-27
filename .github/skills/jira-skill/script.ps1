#Requires -Version 5.1
# =============================================================================
# Jira Skill - Projet CONTRASTE
# Module PowerShell pour interagir avec l'API Jira REST v2
# Extraction de donnees KPI pour le dashboard
# =============================================================================

#region Configuration

$script:JIRA_URL     = if ($env:JIRA_URL)         { $env:JIRA_URL }         else { "https://portail.agir.orange.com" }
$script:JIRA_EMAIL   = if ($env:JIRA_EMAIL)        { $env:JIRA_EMAIL }       else { [Environment]::GetEnvironmentVariable("JIRA_EMAIL",     "User") }
$script:JIRA_TOKEN   = if ($env:JIRA_TOKEN)        { $env:JIRA_TOKEN }       else { [Environment]::GetEnvironmentVariable("JIRA_TOKEN",     "User") }
$script:JIRA_PROJECT = if ($env:JIRA_PROJECT_KEY)  { $env:JIRA_PROJECT_KEY }  else { "CONTRASTE" }

#endregion

#region Infrastructure privee

function Get-JiraHeaders {
    if ([string]::IsNullOrEmpty($script:JIRA_EMAIL) -or [string]::IsNullOrEmpty($script:JIRA_TOKEN)) {
        Write-Host "[ERR] Configuration Jira manquante. Definissez JIRA_EMAIL et JIRA_TOKEN." -ForegroundColor Red
        return $null
    }
    return @{
        "Authorization" = "Bearer $script:JIRA_TOKEN"
        "Content-Type"  = "application/json"
    }
}

# Wrapper HTTP centralise : auth + serialisation JSON + gestion d'erreur
function Invoke-JiraRequest {
    param(
        [Parameter(Mandatory)][string] $Path,
        [string]                       $Method  = "Get",
        [hashtable]                    $Body    = $null,
        [string]                       $Context = "Requete Jira"
    )

    $headers = Get-JiraHeaders
    if ($null -eq $headers) { return $null }

    $params = @{ Uri = "$script:JIRA_URL$Path"; Headers = $headers; Method = $Method }
    if ($null -ne $Body) { $params.Body = ($Body | ConvertTo-Json -Depth 10) }

    try   { return Invoke-RestMethod @params }
    catch {
        Write-Host "[ERR] $Context" -ForegroundColor Red
        Write-Host "      $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

#endregion

#region Authentification

function Test-JiraConnection {
    <#.SYNOPSIS Teste la connexion Jira et affiche l'utilisateur connecte.#>
    $me = Invoke-JiraRequest -Path "/rest/api/2/myself" -Context "Test de connexion"
    if ($null -eq $me) { return }
    Write-Host ""
    Write-Host "[OK] Connexion reussie" -ForegroundColor Green
    Write-Host "     Utilisateur : $($me.displayName)" -ForegroundColor Cyan
    Write-Host "     Email       : $($me.emailAddress)" -ForegroundColor Gray
    Write-Host ""
    return $me
}

#endregion

#region Gestion des issues

function Get-JiraIssue {
    <#.SYNOPSIS Recupere et affiche les details d'une issue Jira.#>
    param([Parameter(Mandatory)][string]$IssueKey)

    $issue = Invoke-JiraRequest -Path "/rest/api/2/issue/$IssueKey" -Context "Recuperation de $IssueKey"
    if ($null -eq $issue) { return }

    $sep = "=" * 67
    Write-Host ""
    Write-Host $sep -ForegroundColor Cyan
    Write-Host "  $($issue.key)  -  $($issue.fields.summary)" -ForegroundColor Yellow
    Write-Host $sep -ForegroundColor Cyan
    Write-Host ""
    Write-Host ("  {0,-12}" -f "Type")     -NoNewline -ForegroundColor White; Write-Host $issue.fields.issuetype.name -ForegroundColor Gray
    Write-Host ("  {0,-12}" -f "Statut")   -NoNewline -ForegroundColor White; Write-Host $issue.fields.status.name    -ForegroundColor Yellow
    Write-Host ("  {0,-12}" -f "Priorite") -NoNewline -ForegroundColor White; Write-Host $issue.fields.priority.name  -ForegroundColor Magenta
    if ($issue.fields.assignee) {
        Write-Host ("  {0,-12}" -f "Assigne a") -NoNewline -ForegroundColor White
        Write-Host $issue.fields.assignee.displayName -ForegroundColor Cyan
    }
    if ($issue.fields.duedate) {
        Write-Host ("  {0,-12}" -f "Echeance") -NoNewline -ForegroundColor White
        Write-Host $issue.fields.duedate -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "  Description :" -ForegroundColor Cyan
    Write-Host $issue.fields.description
    Write-Host ""
    Write-Host $sep -ForegroundColor Cyan
    Write-Host ""
    return $issue
}

function Search-JiraIssues {
    <#.SYNOPSIS Recherche des issues via JQL.#>
    param(
        [Parameter(Mandatory)][string]$JQL,
        [int]$MaxResults = 50
    )

    $result = Invoke-JiraRequest -Path "/rest/api/2/search" -Method "Post" -Context "Recherche JQL" -Body @{
        jql        = $JQL
        maxResults = $MaxResults
        fields     = @("summary", "status", "assignee", "priority", "issuetype")
    }
    if ($null -eq $result) { return }

    Write-Host ""
    Write-Host "JQL      : $JQL" -ForegroundColor Cyan
    Write-Host "Resultats: $($result.total) issue(s)" -ForegroundColor Yellow
    Write-Host ""
    foreach ($issue in $result.issues) {
        Write-Host "  [$($issue.key)]" -NoNewline -ForegroundColor Yellow
        Write-Host " $($issue.fields.summary)" -ForegroundColor White
        Write-Host "    $($issue.fields.status.name) | $($issue.fields.priority.name)" -ForegroundColor Gray
        Write-Host ""
    }
    return $result
}

function Get-MyCurrentIssues {
    <#.SYNOPSIS Liste vos issues en cours (non terminees nie annulees).#>
    param([int]$MaxResults = 20)
    $jql = "assignee = currentUser() AND status NOT IN (CLOSED, CANCELLED) ORDER BY priority DESC, updated DESC"
    Search-JiraIssues -JQL $jql -MaxResults $MaxResults
}

function Get-JiraAttachments {
    <#.SYNOPSIS Liste les pieces jointes d'une issue et retourne leurs metadonnees.#>
    param([Parameter(Mandatory)][string]$IssueKey)

    $issue = Invoke-JiraRequest -Path "/rest/api/2/issue/$IssueKey?fields=attachment" -Context "Pieces jointes de $IssueKey"
    if ($null -eq $issue) { return }

    $attachments = $issue.fields.attachment
    if ($null -eq $attachments -or $attachments.Count -eq 0) {
        Write-Host "[INFO] Aucune piece jointe sur $IssueKey" -ForegroundColor Yellow
        return @()
    }

    Write-Host ""
    Write-Host "Pieces jointes - $IssueKey ($($attachments.Count))" -ForegroundColor Cyan
    Write-Host ""
    foreach ($a in $attachments) {
        Write-Host ("  [{0}] {1,-40} {2,8} Ko" -f $a.id, $a.filename, [math]::Round($a.size / 1KB, 1)) -ForegroundColor White
        Write-Host ("         Auteur: {0}  |  Date: {1}" -f $a.author.displayName, $a.created) -ForegroundColor Gray
        Write-Host ("         URL   : {0}" -f $a.content) -ForegroundColor DarkCyan
        Write-Host ""
    }
    return $attachments
}

function Get-JiraAttachmentContent {
    <#
    .SYNOPSIS
        Telecharge et retourne le contenu textuel d'une piece jointe Jira.
    .DESCRIPTION
        Utilise l'URL de contenu fournie par l'API Jira pour recuperer le fichier.
        Adapte aux fichiers texte/code (Java, XML, JSON, SQL, TXT, CSV, etc.).
        Pour les fichiers binaires (PDF, images), retourne le chemin du fichier sauvegarde.
    .PARAMETER AttachmentUrl
        URL directe du contenu de la piece jointe (champ 'content' retourne par Get-JiraAttachments).
    .PARAMETER Filename
        Nom du fichier original (utilise pour determiner le type et le nom de sauvegarde).
    .PARAMETER SavePath
        Dossier de destination pour les fichiers binaires (defaut: dossier temporaire).
    #>
    param(
        [Parameter(Mandatory)][string]$AttachmentUrl,
        [Parameter(Mandatory)][string]$Filename,
        [string]$SavePath = $env:TEMP
    )

    $headers = Get-JiraHeaders
    if ($null -eq $headers) { return $null }

    # Extensions texte supportees pour lecture directe
    $textExtensions = @('.java','.xml','.json','.sql','.txt','.csv','.yaml','.yml','.properties','.md','.drl','.groovy','.kt','.py','.sh','.bat','.ps1')
    $ext = [System.IO.Path]::GetExtension($Filename).ToLower()

    try {
        if ($textExtensions -contains $ext) {
            # Lecture directe du contenu texte
            $content = Invoke-RestMethod -Uri $AttachmentUrl -Headers $headers -Method Get
            Write-Host "[OK] Contenu lu : $Filename ($($content.Length) caracteres)" -ForegroundColor Green
            return $content
        } else {
            # Sauvegarde du fichier binaire
            $destPath = Join-Path $SavePath $Filename
            Invoke-WebRequest -Uri $AttachmentUrl -Headers $headers -OutFile $destPath
            Write-Host "[OK] Fichier binaire sauvegarde : $destPath" -ForegroundColor Green
            return $destPath
        }
    }
    catch {
        Write-Host "[ERR] Impossible de telecharger $Filename : $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

#endregion

#region Commentaires

function Get-JiraComments {
    <#.SYNOPSIS Liste tous les commentaires d'une issue.#>
    param([Parameter(Mandatory)][string]$IssueKey)

    $result = Invoke-JiraRequest -Path "/rest/api/2/issue/$IssueKey/comment" -Context "Commentaires de $IssueKey"
    if ($null -eq $result) { return }

    Write-Host ""
    Write-Host "Commentaires - $IssueKey ($($result.total))" -ForegroundColor Cyan
    Write-Host ""
    foreach ($c in $result.comments) {
        Write-Host ("-" * 67) -ForegroundColor Gray
        Write-Host "$($c.author.displayName)  $($c.created)" -ForegroundColor Yellow
        Write-Host $c.body
        Write-Host ""
    }
    return $result
}

function Add-JiraComment {
    <#.SYNOPSIS Ajoute un commentaire a une issue. Supporte le pipeline.#>
    param(
        [Parameter(Mandatory, ValueFromPipeline)][string]$IssueKey,
        [Parameter(Mandatory)][string]$Comment
    )
    process {
        $result = Invoke-JiraRequest -Path "/rest/api/2/issue/$IssueKey/comment" -Method "Post" `
            -Body @{ body = $Comment } -Context "Ajout commentaire sur $IssueKey"
        if ($null -ne $result) { Write-Host "[OK] Commentaire ajoute a $IssueKey" -ForegroundColor Green }
    }
}

#endregion

#region Assignation

function Set-JiraIssueAssignee {
    <#.SYNOPSIS Assigne une issue a un utilisateur.#>
    param(
        [Parameter(Mandatory)][string]$IssueKey,
        [Parameter(Mandatory)][string]$Username
    )
    # PUT /assignee retourne 204 (sans body) - erreur levee par Invoke-JiraRequest si echec
    Invoke-JiraRequest -Path "/rest/api/2/issue/$IssueKey/assignee" -Method "Put" `
        -Body @{ name = $Username } -Context "Assignation de $IssueKey" | Out-Null
    Write-Host "[OK] $IssueKey assigne a $Username" -ForegroundColor Green
}

function Assign-JiraIssueToMe {
    <#.SYNOPSIS S'auto-assigne une issue Jira.#>
    param([Parameter(Mandatory)][string]$IssueKey)

    $me = Invoke-JiraRequest -Path "/rest/api/2/myself" -Context "Recuperation du profil"
    if ($null -eq $me) { return }

    Invoke-JiraRequest -Path "/rest/api/2/issue/$IssueKey/assignee" -Method "Put" `
        -Body @{ name = $me.name } -Context "Auto-assignation de $IssueKey" | Out-Null
    Write-Host "[OK] $IssueKey auto-assigne a $($me.displayName)" -ForegroundColor Green
}

#endregion

#region Transitions

function Get-JiraTransitions {
    <#.SYNOPSIS Liste les transitions disponibles pour une issue.#>
    param([Parameter(Mandatory)][string]$IssueKey)

    $result = Invoke-JiraRequest -Path "/rest/api/2/issue/$IssueKey/transitions" -Context "Transitions de $IssueKey"
    if ($null -eq $result) { return }

    Write-Host ""
    Write-Host "Transitions disponibles - $IssueKey" -ForegroundColor Cyan
    Write-Host ""
    foreach ($t in $result.transitions) {
        Write-Host ("  [{0,3}] -> {1}" -f $t.id, $t.to.name) -ForegroundColor White
    }
    Write-Host ""
    return $result
}

function Set-JiraIssueTransition {
    <#.SYNOPSIS Applique une transition par son ID (obtenu via Get-JiraTransitions).#>
    param(
        [Parameter(Mandatory)][string]$IssueKey,
        [Parameter(Mandatory)][string]$TransitionId
    )
    Invoke-JiraRequest -Path "/rest/api/2/issue/$IssueKey/transitions" -Method "Post" `
        -Body @{ transition = @{ id = $TransitionId } } -Context "Transition $TransitionId sur $IssueKey" | Out-Null
    Write-Host "[OK] Transition $TransitionId appliquee a $IssueKey" -ForegroundColor Green
}

# Moteur interne : resout le nom de statut en ID de transition via l'API
function Invoke-JiraTransitionByName {
    param(
        [Parameter(Mandatory)][string]$IssueKey,
        [Parameter(Mandatory)][string]$TargetStatus
    )

    $result = Invoke-JiraRequest -Path "/rest/api/2/issue/$IssueKey/transitions" -Context "Recherche transition '$TargetStatus'"
    if ($null -eq $result) { return }

    $t = $result.transitions | Where-Object { $_.to.name -ieq $TargetStatus } | Select-Object -First 1
    if ($null -eq $t) {
        Write-Host "[WARN] '$TargetStatus' non disponible pour $IssueKey" -ForegroundColor Yellow
        Write-Host "       Disponibles : $(($result.transitions | ForEach-Object { $_.to.name }) -join ', ')" -ForegroundColor Gray
        return
    }

    Invoke-JiraRequest -Path "/rest/api/2/issue/$IssueKey/transitions" -Method "Post" `
        -Body @{ transition = @{ id = $t.id } } -Context "Transition -> $TargetStatus" | Out-Null
    Write-Host "[OK] $IssueKey -> $TargetStatus" -ForegroundColor Green
}

# ------------------------------------------------------------------
# Transitions nommees -- Workflow KOA complet
# DRAFT -> ANALYSING -> READY FOR REFINEMENT -> READY FOR DEV
#       -> IN PROGRESS <-> ON HOLD
#       -> IN REVIEW -> READY FOR TEST -> TEST IN PROGRESS
#       -> READY FOR DELIVERY <-> CLOSED
# ALL   -> CANCELLED
# CLOSED/ANY -> REOPENED -> READY FOR DEV
# ------------------------------------------------------------------
function Set-JiraStatusAnalysing          { param([Parameter(Mandatory)][string]$k) Invoke-JiraTransitionByName $k "ANALYSING"           }
function Set-JiraStatusReadyForRefinement { param([Parameter(Mandatory)][string]$k) Invoke-JiraTransitionByName $k "READY FOR REFINEMENT" }
function Set-JiraStatusReadyForDev        { param([Parameter(Mandatory)][string]$k) Invoke-JiraTransitionByName $k "READY FOR DEV"        }
function Set-JiraStatusOnHold             { param([Parameter(Mandatory)][string]$k) Invoke-JiraTransitionByName $k "ON HOLD"              }
function Set-JiraStatusInProgress         { param([Parameter(Mandatory)][string]$k) Invoke-JiraTransitionByName $k "IN PROGRESS"          }
function Set-JiraStatusInReview           { param([Parameter(Mandatory)][string]$k) Invoke-JiraTransitionByName $k "IN REVIEW"            }
function Set-JiraStatusReadyForTest       { param([Parameter(Mandatory)][string]$k) Invoke-JiraTransitionByName $k "READY FOR TEST"       }
function Set-JiraStatusTestInProgress     { param([Parameter(Mandatory)][string]$k) Invoke-JiraTransitionByName $k "TEST IN PROGRESS"     }
function Set-JiraStatusReadyForDelivery   { param([Parameter(Mandatory)][string]$k) Invoke-JiraTransitionByName $k "READY FOR DELIVERY"   }
function Set-JiraStatusClosed             { param([Parameter(Mandatory)][string]$k) Invoke-JiraTransitionByName $k "CLOSED"               }
function Set-JiraStatusCancelled          { param([Parameter(Mandatory)][string]$k) Invoke-JiraTransitionByName $k "CANCELLED"            }
function Set-JiraStatusReopened           { param([Parameter(Mandatory)][string]$k) Invoke-JiraTransitionByName $k "REOPENED"             }

#endregion

#region Extraction KPI -- Projet CONTRASTE

function Get-JiraProjectBoards {
    <#.SYNOPSIS Liste les boards Scrum/Kanban du projet configure.#>
    param([string]$ProjectKey = $script:JIRA_PROJECT)

    $result = Invoke-JiraRequest -Path "/rest/agile/1.0/board?projectKeyOrId=$ProjectKey" -Context "Boards du projet $ProjectKey"
    if ($null -eq $result) { return }

    Write-Host ""
    Write-Host "Boards - $ProjectKey ($($result.values.Count))" -ForegroundColor Cyan
    foreach ($b in $result.values) {
        Write-Host ("  [{0,4}] {1,-40} ({2})" -f $b.id, $b.name, $b.type) -ForegroundColor White
    }
    Write-Host ""
    return $result.values
}

function Get-JiraSprints {
    <#.SYNOPSIS Liste les sprints d'un board (actifs, futurs, fermes).#>
    param(
        [Parameter(Mandatory)][int]$BoardId,
        [ValidateSet('active','closed','future','')][string]$State = ''
    )

    $path = "/rest/agile/1.0/board/$BoardId/sprint?maxResults=50"
    if ($State) { $path += "&state=$State" }

    $result = Invoke-JiraRequest -Path $path -Context "Sprints du board $BoardId"
    if ($null -eq $result) { return }

    Write-Host ""
    Write-Host "Sprints - Board $BoardId ($($result.values.Count))" -ForegroundColor Cyan
    foreach ($s in $result.values) {
        $color = switch ($s.state) { 'active' { 'Green' } 'closed' { 'Gray' } default { 'Yellow' } }
        Write-Host ("  [{0,4}] {1,-35} {2,-8} {3} -> {4}" -f $s.id, $s.name, $s.state, $s.startDate, $s.endDate) -ForegroundColor $color
    }
    Write-Host ""
    return $result.values
}

function Get-JiraSprintIssues {
    <#.SYNOPSIS Recupere toutes les issues d'un sprint avec les champs utiles pour les KPIs.#>
    param(
        [Parameter(Mandatory)][int]$SprintId,
        [int]$MaxResults = 200
    )

    $jql = "sprint = $SprintId ORDER BY key ASC"
    $fields = @("summary","status","issuetype","priority","assignee","created","resolutiondate","issuelinks","subtasks","labels","components")

    $allIssues = @()
    $startAt = 0

    do {
        $result = Invoke-JiraRequest -Path "/rest/api/2/search" -Method "Post" -Context "Issues sprint $SprintId (offset $startAt)" -Body @{
            jql        = $jql
            startAt    = $startAt
            maxResults = 50
            fields     = $fields
        }
        if ($null -eq $result) { return $allIssues }

        $allIssues += $result.issues
        $startAt += $result.issues.Count
    } while ($startAt -lt $result.total -and $startAt -lt $MaxResults)

    Write-Host ""
    Write-Host "Sprint $SprintId : $($allIssues.Count) issues chargees" -ForegroundColor Cyan
    return $allIssues
}

function Get-JiraSprintUS {
    <#.SYNOPSIS Recupere uniquement les User Stories d'un sprint (exclut Bug et Sub-task).#>
    param([Parameter(Mandatory)][int]$SprintId)

    $issues = Get-JiraSprintIssues -SprintId $SprintId
    if ($null -eq $issues) { return @() }

    $excluded = @('Bug', 'Sub-task', 'Sous-tache')
    $us = $issues | Where-Object { $excluded -notcontains $_.fields.issuetype.name }

    Write-Host "  -> $($us.Count) User Stories (hors Bug/Sub-task)" -ForegroundColor Green
    return $us
}

function Get-JiraIssueChangelog {
    <#.SYNOPSIS Recupere l'historique complet des changements d'une issue (transitions, champs).#>
    param(
        [Parameter(Mandatory)][string]$IssueKey,
        [int]$MaxResults = 100
    )

    $result = Invoke-JiraRequest -Path "/rest/api/2/issue/$IssueKey`?expand=changelog&fields=summary,status,issuetype" -Context "Changelog de $IssueKey"
    if ($null -eq $result) { return $null }

    return $result.changelog.histories
}

function Get-JiraIssueStatusTransitions {
    <#
    .SYNOPSIS Extrait les transitions de statut d'une issue depuis son changelog.
    .DESCRIPTION Retourne un tableau d'objets avec : date, fromStatus, toStatus, author.
    Utile pour calculer Lead Time, Cycle Time, et iterations MR.
    #>
    param([Parameter(Mandatory)][string]$IssueKey)

    $histories = Get-JiraIssueChangelog -IssueKey $IssueKey
    if ($null -eq $histories) { return @() }

    $transitions = @()
    foreach ($h in $histories) {
        foreach ($item in $h.items) {
            if ($item.field -eq 'status') {
                $transitions += [PSCustomObject]@{
                    Date       = [datetime]$h.created
                    FromStatus = $item.fromString
                    ToStatus   = $item.toString
                    Author     = $h.author.displayName
                    AuthorKey  = $h.author.name
                }
            }
        }
    }

    return $transitions
}

# --- KPI-02 : Taux de realisation des US ---

function Get-KPICompletionRate {
    <#
    .SYNOPSIS Calcule le taux de realisation des US pour un sprint (EPIC-02).
    .DESCRIPTION Retourne : totalUS, done, remaining, completionRate%.
    Les statuts 'Done' sont configures via le parametre DoneStatuses.
    #>
    param(
        [Parameter(Mandatory)][int]$SprintId,
        [string[]]$DoneStatuses = @('CLOSED', 'READY FOR DELIVERY', 'Done')
    )

    $us = Get-JiraSprintUS -SprintId $SprintId
    if ($us.Count -eq 0) {
        Write-Host "[WARN] Aucune US dans le sprint $SprintId" -ForegroundColor Yellow
        return $null
    }

    $done      = @($us | Where-Object { $DoneStatuses -contains $_.fields.status.name })
    $remaining = @($us | Where-Object { $DoneStatuses -notcontains $_.fields.status.name })

    $rate = [math]::Round(($done.Count / $us.Count) * 100, 1)

    $result = [PSCustomObject]@{
        SprintId              = $SprintId
        TotalUS               = $us.Count
        DoneCount             = $done.Count
        RemainingCount        = $remaining.Count
        CompletionRatePercent = $rate
        DoneIssues            = $done | ForEach-Object { $_.key }
        RemainingIssues       = $remaining | ForEach-Object { $_.key }
    }

    Write-Host ""
    Write-Host "=== KPI Taux de realisation -- Sprint $SprintId ===" -ForegroundColor Cyan
    Write-Host "  Total US     : $($result.TotalUS)" -ForegroundColor White
    Write-Host "  Done         : $($result.DoneCount)" -ForegroundColor Green
    Write-Host "  Remaining    : $($result.RemainingCount)" -ForegroundColor Yellow
    Write-Host "  Taux         : $($result.CompletionRatePercent) %" -ForegroundColor $(if ($rate -ge 80) { 'Green' } elseif ($rate -ge 50) { 'Yellow' } else { 'Red' })
    Write-Host ""
    return $result
}

# --- KPI-03 : Iterations MR (allers-retours review) ---

function Get-KPIMRIterations {
    <#
    .SYNOPSIS Calcule le nombre d'iterations MR par US (EPIC-03).
    .DESCRIPTION Compte les allers-retours In Review -> In Progress / Changes Requested.
    #>
    param(
        [Parameter(Mandatory)][int]$SprintId,
        [string[]]$ReviewStatuses   = @('IN REVIEW', 'In Review'),
        [string[]]$ReworkStatuses   = @('IN PROGRESS', 'In Progress', 'READY FOR DEV', 'Ready for Dev', 'Changes Requested')
    )

    $us = Get-JiraSprintUS -SprintId $SprintId
    if ($us.Count -eq 0) { return $null }

    $results = @()
    foreach ($issue in $us) {
        $transitions = Get-JiraIssueStatusTransitions -IssueKey $issue.key
        $iterations = 0

        foreach ($t in $transitions) {
            if ($ReviewStatuses -contains $t.FromStatus -and $ReworkStatuses -contains $t.ToStatus) {
                $iterations++
            }
        }

        $results += [PSCustomObject]@{
            IssueKey   = $issue.key
            Summary    = $issue.fields.summary
            Iterations = if ($iterations -gt 0) { $iterations } else { $null }
        }
    }

    $withData  = @($results | Where-Object { $null -ne $_.Iterations })
    $avgIter   = if ($withData.Count -gt 0) { [math]::Round(($withData | Measure-Object -Property Iterations -Average).Average, 1) } else { 0 }

    Write-Host ""
    Write-Host "=== KPI Iterations MR -- Sprint $SprintId ===" -ForegroundColor Cyan
    Write-Host "  US analysees : $($us.Count)" -ForegroundColor White
    Write-Host "  Avec donnees : $($withData.Count)" -ForegroundColor White
    Write-Host "  Moyenne iter : $avgIter" -ForegroundColor $(if ($avgIter -le 1) { 'Green' } elseif ($avgIter -le 3) { 'Yellow' } else { 'Red' })
    Write-Host ""
    return [PSCustomObject]@{
        SprintId         = $SprintId
        TotalUS          = $us.Count
        AverageIterations = $avgIter
        Details          = $results
    }
}

# --- KPI-04 : Lead Time / Cycle Time ---

function Get-KPILeadCycleTime {
    <#
    .SYNOPSIS Calcule le Lead Time et Cycle Time par US (EPIC-04).
    .DESCRIPTION
        Lead Time  = premiere transition vers un statut actif -> derniere transition vers Done.
        Cycle Time = temps cumule dans les statuts actifs (In Progress, In Review).
    #>
    param(
        [Parameter(Mandatory)][int]$SprintId,
        [string[]]$StartStatuses  = @('ANALYSING', 'Analysing', 'READY FOR DEV', 'Ready for Dev', 'IN PROGRESS', 'In Progress'),
        [string[]]$ActiveStatuses = @('IN PROGRESS', 'In Progress', 'IN REVIEW', 'In Review'),
        [string[]]$DoneStatuses   = @('CLOSED', 'READY FOR DELIVERY', 'Done')
    )

    $us = Get-JiraSprintUS -SprintId $SprintId
    if ($us.Count -eq 0) { return $null }

    $results = @()
    foreach ($issue in $us) {
        $transitions = Get-JiraIssueStatusTransitions -IssueKey $issue.key
        if ($transitions.Count -eq 0) { continue }

        # Lead Time : premiere entree dans un statut actif -> derniere sortie vers Done
        $firstStart = $transitions | Where-Object { $StartStatuses -contains $_.ToStatus } | Select-Object -First 1
        $lastDone   = $transitions | Where-Object { $DoneStatuses -contains $_.ToStatus }  | Select-Object -Last 1

        $leadTimeH = $null
        if ($firstStart -and $lastDone) {
            $leadTimeH = [math]::Round(($lastDone.Date - $firstStart.Date).TotalHours, 1)
        }

        # Cycle Time : cumul du temps passe dans les statuts actifs
        $cycleTimeH = 0
        for ($i = 0; $i -lt $transitions.Count; $i++) {
            if ($ActiveStatuses -contains $transitions[$i].ToStatus) {
                $enterDate = $transitions[$i].Date
                $exitDate  = if ($i + 1 -lt $transitions.Count) { $transitions[$i + 1].Date } else { Get-Date }
                $cycleTimeH += ($exitDate - $enterDate).TotalHours
            }
        }
        $cycleTimeH = [math]::Round($cycleTimeH, 1)

        $results += [PSCustomObject]@{
            IssueKey    = $issue.key
            Summary     = $issue.fields.summary
            LeadTimeH   = $leadTimeH
            CycleTimeH  = if ($cycleTimeH -gt 0) { $cycleTimeH } else { $null }
        }
    }

    $withLead  = @($results | Where-Object { $null -ne $_.LeadTimeH })
    $withCycle = @($results | Where-Object { $null -ne $_.CycleTimeH })
    $avgLead   = if ($withLead.Count  -gt 0) { [math]::Round(($withLead  | Measure-Object -Property LeadTimeH  -Average).Average, 1) } else { 0 }
    $avgCycle  = if ($withCycle.Count -gt 0) { [math]::Round(($withCycle | Measure-Object -Property CycleTimeH -Average).Average, 1) } else { 0 }

    Write-Host ""
    Write-Host "=== KPI Lead / Cycle Time -- Sprint $SprintId ===" -ForegroundColor Cyan
    Write-Host "  US analysees     : $($us.Count)" -ForegroundColor White
    Write-Host "  Avg Lead Time    : ${avgLead}h" -ForegroundColor Yellow
    Write-Host "  Avg Cycle Time   : ${avgCycle}h" -ForegroundColor Yellow
    Write-Host ""
    return [PSCustomObject]@{
        SprintId          = $SprintId
        TotalUS           = $us.Count
        AverageLeadTimeH  = $avgLead
        AverageCycleTimeH = $avgCycle
        Details           = $results
    }
}

# --- KPI-05 : Bugs par US ---

function Get-KPIBugsPerUS {
    <#
    .SYNOPSIS Calcule le ratio de bugs par US pour un sprint (EPIC-05).
    .DESCRIPTION Compte les issues de type Bug liees aux US via issuelinks, subtasks, ou meme sprint+composant.
    #>
    param([Parameter(Mandatory)][int]$SprintId)

    $allIssues = Get-JiraSprintIssues -SprintId $SprintId
    if ($null -eq $allIssues -or $allIssues.Count -eq 0) { return $null }

    $excluded = @('Bug', 'Sub-task', 'Sous-tache')
    $us   = @($allIssues | Where-Object { $excluded -notcontains $_.fields.issuetype.name })
    $bugs = @($allIssues | Where-Object { $_.fields.issuetype.name -eq 'Bug' })

    # Associer les bugs aux US via issuelinks
    $bugMap = @{}
    foreach ($u in $us) {
        $linkedBugs = @()
        if ($u.fields.issuelinks) {
            foreach ($link in $u.fields.issuelinks) {
                $linked = if ($link.outwardIssue) { $link.outwardIssue } elseif ($link.inwardIssue) { $link.inwardIssue } else { $null }
                if ($linked -and $linked.fields.issuetype.name -eq 'Bug') {
                    $linkedBugs += $linked.key
                }
            }
        }
        # Bugs du meme sprint (meme composant ou meme label)
        foreach ($bug in $bugs) {
            if ($linkedBugs -notcontains $bug.key) {
                $sharedComponent = $false
                if ($u.fields.components -and $bug.fields.components) {
                    $uComps   = $u.fields.components   | ForEach-Object { $_.name }
                    $bugComps = $bug.fields.components | ForEach-Object { $_.name }
                    $sharedComponent = ($uComps | Where-Object { $bugComps -contains $_ }).Count -gt 0
                }
                $sharedLabel = $false
                if ($u.fields.labels -and $bug.fields.labels) {
                    $sharedLabel = ($u.fields.labels | Where-Object { $bug.fields.labels -contains $_ }).Count -gt 0
                }
                if ($sharedComponent -or $sharedLabel) {
                    $linkedBugs += $bug.key
                }
            }
        }
        $bugMap[$u.key] = $linkedBugs | Select-Object -Unique
    }

    $totalBugs   = ($bugMap.Values | ForEach-Object { $_ } | Select-Object -Unique).Count
    $doneUS      = @($us | Where-Object { @('CLOSED','READY FOR DELIVERY','Done') -contains $_.fields.status.name })
    $bugsPerUS   = if ($doneUS.Count -gt 0) { [math]::Round($totalBugs / $doneUS.Count, 2) } else { 0 }

    $details = $us | ForEach-Object {
        [PSCustomObject]@{
            IssueKey  = $_.key
            Summary   = $_.fields.summary
            BugCount  = ($bugMap[$_.key]).Count
            BugKeys   = ($bugMap[$_.key]) -join ', '
        }
    }

    Write-Host ""
    Write-Host "=== KPI Bugs par US -- Sprint $SprintId ===" -ForegroundColor Cyan
    Write-Host "  Total US         : $($us.Count)" -ForegroundColor White
    Write-Host "  Total Bugs       : $totalBugs" -ForegroundColor $(if ($totalBugs -eq 0) { 'Green' } else { 'Yellow' })
    Write-Host "  Bugs / US (done) : $bugsPerUS" -ForegroundColor $(if ($bugsPerUS -le 0.5) { 'Green' } elseif ($bugsPerUS -le 1) { 'Yellow' } else { 'Red' })
    Write-Host ""
    return [PSCustomObject]@{
        SprintId       = $SprintId
        TotalUS        = $us.Count
        TotalBugs      = $totalBugs
        DoneUSCount    = $doneUS.Count
        BugsPerUS      = $bugsPerUS
        Details        = $details
    }
}

# --- Aggregation : tous les KPIs d'un sprint ---

function Get-JiraSprintKPIData {
    <#
    .SYNOPSIS Calcule les 4 KPIs pour un sprint donne.
    .DESCRIPTION Fonction principale d'extraction. Retourne un objet avec les resultats des 4 KPIs.
    .EXAMPLE
        $boards = Get-JiraProjectBoards
        $sprints = Get-JiraSprints -BoardId $boards[0].id -State active
        $kpis = Get-JiraSprintKPIData -SprintId $sprints[0].id
    #>
    param([Parameter(Mandatory)][int]$SprintId)

    Write-Host ""
    Write-Host ("=" * 67) -ForegroundColor Cyan
    Write-Host "  Extraction KPIs -- Sprint $SprintId -- Projet $script:JIRA_PROJECT" -ForegroundColor Cyan
    Write-Host ("=" * 67) -ForegroundColor Cyan
    Write-Host ""

    $completionRate = Get-KPICompletionRate -SprintId $SprintId
    $mrIterations   = Get-KPIMRIterations   -SprintId $SprintId
    $leadCycleTime  = Get-KPILeadCycleTime  -SprintId $SprintId
    $bugsPerUS      = Get-KPIBugsPerUS      -SprintId $SprintId

    return [PSCustomObject]@{
        Project        = $script:JIRA_PROJECT
        SprintId       = $SprintId
        ExtractedAt    = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
        CompletionRate = $completionRate
        MRIterations   = $mrIterations
        LeadCycleTime  = $leadCycleTime
        BugsPerUS      = $bugsPerUS
    }
}

function Export-KPIDataToJson {
    <#.SYNOPSIS Exporte les donnees KPI d'un sprint vers un fichier JSON.#>
    param(
        [Parameter(Mandatory)][int]$SprintId,
        [string]$OutputPath = "./kpi-data-sprint-$SprintId.json"
    )

    $data = Get-JiraSprintKPIData -SprintId $SprintId
    $data | ConvertTo-Json -Depth 10 | Set-Content -Path $OutputPath -Encoding UTF8
    Write-Host "[OK] KPIs exportes vers $OutputPath" -ForegroundColor Green
    return $data
}

#endregion

#region Alias et message de demarrage

Set-Alias -Name jira-test     -Value Test-JiraConnection   -Scope Global -Force
Set-Alias -Name jira-issue    -Value Get-JiraIssue         -Scope Global -Force
Set-Alias -Name jira-search   -Value Search-JiraIssues     -Scope Global -Force
Set-Alias -Name jira-mine     -Value Get-MyCurrentIssues   -Scope Global -Force
Set-Alias -Name jira-boards   -Value Get-JiraProjectBoards -Scope Global -Force
Set-Alias -Name jira-sprints  -Value Get-JiraSprints       -Scope Global -Force
Set-Alias -Name jira-kpis     -Value Get-JiraSprintKPIData -Scope Global -Force

$sep = "=" * 67
Write-Host ""
Write-Host $sep -ForegroundColor Cyan
Write-Host "  Jira Skill - Projet $script:JIRA_PROJECT" -ForegroundColor Cyan
Write-Host $sep -ForegroundColor Cyan
Write-Host ""
if ($script:JIRA_EMAIL -and $script:JIRA_TOKEN) {
    Write-Host "  Configuration : " -NoNewline; Write-Host "OK" -ForegroundColor Green
    Write-Host "  Email         : $script:JIRA_EMAIL" -ForegroundColor Gray
    Write-Host "  Projet        : $script:JIRA_PROJECT" -ForegroundColor Gray
} else {
    Write-Host "  Configuration : " -NoNewline; Write-Host "MANQUANTE" -ForegroundColor Red
    Write-Host "  Definissez JIRA_EMAIL et JIRA_TOKEN." -ForegroundColor Yellow
}
Write-Host ""
Write-Host "  Issues          Get-JiraIssue <key> | Search-JiraIssues <jql> | Get-MyCurrentIssues" -ForegroundColor White
Write-Host "  Pieces jointes  Get-JiraAttachments <key> | Get-JiraAttachmentContent <url> <filename>" -ForegroundColor White
Write-Host "  Commentaires    Get-JiraComments <key> | Add-JiraComment <key> <text>" -ForegroundColor White
Write-Host "  Assignation     Assign-JiraIssueToMe <key> | Set-JiraIssueAssignee <key> <user>" -ForegroundColor White
Write-Host "  Transitions     Get-JiraTransitions <key> | Set-JiraIssueTransition <key> <id>" -ForegroundColor White
Write-Host "  Auth            Test-JiraConnection" -ForegroundColor White
Write-Host ""
Write-Host "  KPI Dashboard :" -ForegroundColor Cyan
Write-Host "    Get-JiraProjectBoards                  Liste les boards du projet" -ForegroundColor White
Write-Host "    Get-JiraSprints -BoardId <id>           Liste les sprints" -ForegroundColor White
Write-Host "    Get-JiraSprintKPIData -SprintId <id>    Calcule les 4 KPIs" -ForegroundColor White
Write-Host "    Export-KPIDataToJson -SprintId <id>     Exporte en JSON" -ForegroundColor White
Write-Host ""
Write-Host "  Workflow :" -ForegroundColor Cyan
Write-Host "    DRAFT -> ANALYSING -> READY FOR REFINEMENT -> READY FOR DEV" -ForegroundColor Gray
Write-Host "    -> IN PROGRESS <-> ON HOLD -> IN REVIEW -> READY FOR TEST" -ForegroundColor Gray
Write-Host "    -> TEST IN PROGRESS -> READY FOR DELIVERY -> CLOSED" -ForegroundColor Gray
Write-Host "    ALL -> CANCELLED | CLOSED -> REOPENED" -ForegroundColor Gray
Write-Host ""
Write-Host "  Alias : jira-test  jira-issue  jira-search  jira-mine  jira-boards  jira-sprints  jira-kpis" -ForegroundColor Gray
Write-Host $sep -ForegroundColor Cyan
Write-Host ""

#endregion
