/**
 * Kanban KPI calculations.
 *
 * Reuse per-issue functions from existing Sprint KPI modules.
 * Provide aggregate wrappers that accept pre-fetched JiraIssue[] instead of sprintId.
 */
import { JiraClient } from '../clients/jira-client';
import { isUserStory } from '../types/jira.types';
import { isDoneStatus } from '../config/workflow-statuses.config';
import { calculateLeadCycleTime } from './lead-cycle-time.kpi';
import { calculateMRIterations } from './mr-iterations.kpi';
import type { JiraIssue, JiraChangelogHistory } from '../types/jira.types';
import type {
  USCompletionRateResult,
  SprintMRIterationsResult,
  SprintLeadCycleTimeResult,
  SprintBugsResult,
  SprintDevRankingResult,
  MRIterationsResult,
  IterationDistribution,
  TimeStats,
  USBugResult,
  BugDetail,
  BugSeverity,
  BugStatus,
  DevStats,
} from '../types/kpi.types';
import type { Result } from '../types/result.types';
import { success } from '../types/result.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]!
    : ((sorted[mid - 1]! + sorted[mid]!) / 2);
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)]!;
}

function timeStats(values: number[]): TimeStats {
  if (values.length === 0) {
    return { averageHours: null, medianHours: null, p85Hours: null, minHours: null, maxHours: null, sampleSize: 0 };
  }
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    averageHours: round1(sum / values.length),
    medianHours: round1(median(values)!),
    p85Hours: round1(percentile(values, 85)!),
    minHours: round1(Math.min(...values)),
    maxHours: round1(Math.max(...values)),
    sampleSize: values.length,
  };
}

function findLastDoneTransitionAuthor(histories: JiraChangelogHistory[]): string | null {
  for (let i = histories.length - 1; i >= 0; i--) {
    const history = histories[i];
    if (!history) continue;
    for (const item of history.items) {
      if (item.field === 'status' && item.toString && isDoneStatus(item.toString)) {
        return history.author.displayName;
      }
    }
  }
  return null;
}

function isBugType(typeName: string): boolean {
  const lower = typeName.toLowerCase();
  return lower === 'bug' || lower === 'bogue';
}

function mapBugStatus(statusName: string): BugStatus {
  const lower = statusName.toLowerCase();
  if (lower.includes('fermé') || lower.includes('closed') || lower.includes('done') || lower.includes('terminé') || lower.includes('clôturé')) return 'closed';
  if (lower.includes('résolu') || lower.includes('resolved')) return 'resolved';
  if (lower.includes('cours') || lower.includes('progress')) return 'in_progress';
  return 'open';
}

function mapBugSeverity(priority: string): BugSeverity {
  const lower = priority.toLowerCase();
  if (lower.includes('blocker') || lower.includes('bloquant')) return 'blocker';
  if (lower.includes('critical') || lower.includes('critique')) return 'critical';
  if (lower.includes('major') || lower.includes('majeur')) return 'major';
  return 'minor';
}

const SEVERITY_WEIGHTS: Record<BugSeverity, number> = { blocker: 4, critical: 3, major: 2, minor: 1 };

function buildBugDetail(
  key: string, summary: string, priority: string, status: string,
  created: string, resolved: string | null, linkedUSKey: string,
  linkMethod: BugDetail['linkMethod'],
): BugDetail {
  const severity = mapBugSeverity(priority);
  return {
    key, summary, severity,
    status: mapBugStatus(status),
    createdDate: created, resolvedDate: resolved,
    linkedUSKey, linkMethod,
    weightedScore: SEVERITY_WEIGHTS[severity],
  };
}

function deduplicateBugs(bugs: BugDetail[]): BugDetail[] {
  const seen = new Set<string>();
  return bugs.filter((b) => {
    if (seen.has(b.key)) return false;
    seen.add(b.key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Kanban Completion Rate
// ---------------------------------------------------------------------------

export async function calculateKanbanCompletionRate(
  jiraClient: JiraClient,
  stories: JiraIssue[],
  periodLabel: string,
  workflowServiceAccount: string,
): Promise<Result<USCompletionRateResult>> {
  const totalUS = stories.length;
  if (totalUS === 0) {
    return success({
      sprintId: 0,
      sprintName: periodLabel,
      totalUS: 0, doneByWorkflow: 0, doneManually: 0, remaining: 0,
      completionRatePercent: 0, workflowRatePercent: 0,
    });
  }

  let doneByWorkflow = 0;
  let doneManually = 0;

  for (const story of stories) {
    if (!isDoneStatus(story.fields.status.name)) continue;

    const changelogResult = await jiraClient.getIssueWithChangelog(story.key);
    if (!changelogResult.success) return changelogResult;

    const changelog = changelogResult.data.changelog;
    if (!changelog) { doneManually++; continue; }

    const author = findLastDoneTransitionAuthor(changelog.histories);
    if (author === workflowServiceAccount) {
      doneByWorkflow++;
    } else {
      doneManually++;
    }
  }

  const remaining = totalUS - doneByWorkflow - doneManually;
  const totalDone = doneByWorkflow + doneManually;
  return success({
    sprintId: 0,
    sprintName: periodLabel,
    totalUS,
    doneByWorkflow,
    doneManually,
    remaining,
    completionRatePercent: round1((totalDone / totalUS) * 100),
    workflowRatePercent: totalDone > 0 ? round1((doneByWorkflow / totalDone) * 100) : 0,
  });
}

// ---------------------------------------------------------------------------
// Kanban MR Iterations
// ---------------------------------------------------------------------------

export async function calculateKanbanMRIterations(
  jiraClient: JiraClient,
  stories: JiraIssue[],
  periodLabel: string,
): Promise<Result<SprintMRIterationsResult>> {
  const issueDetails: MRIterationsResult[] = [];

  for (const story of stories) {
    const result = await calculateMRIterations(jiraClient, story.key);
    if (result.success) {
      issueDetails.push(result.data);
    }
  }

  const validCounts = issueDetails
    .filter((d) => d.iterationsCount !== null)
    .map((d) => d.iterationsCount!);

  const distribution: IterationDistribution = {
    oneIteration: validCounts.filter((c) => c === 1).length,
    twoIterations: validCounts.filter((c) => c === 2).length,
    threeOrMore: validCounts.filter((c) => c >= 3).length,
    unavailable: issueDetails.filter((d) => d.iterationsCount === null).length,
  };

  const totalWithReview = distribution.oneIteration + distribution.twoIterations + distribution.threeOrMore;
  const firstTimeRightPercent = totalWithReview > 0
    ? Math.round((distribution.oneIteration / totalWithReview) * 1000) / 10
    : null;

  return success({
    sprintId: 0,
    sprintName: periodLabel,
    averageIterations: validCounts.length > 0 ? round1(validCounts.reduce((a, b) => a + b, 0) / validCounts.length) : null,
    medianIterations: median(validCounts) !== null ? round1(median(validCounts)!) : null,
    maxIterations: validCounts.length > 0 ? Math.max(...validCounts) : null,
    distribution,
    firstTimeRightPercent,
    issueDetails,
  });
}

// ---------------------------------------------------------------------------
// Kanban Lead / Cycle Time
// ---------------------------------------------------------------------------

export async function calculateKanbanLeadCycleTime(
  jiraClient: JiraClient,
  stories: JiraIssue[],
  periodLabel: string,
  aiMode = false,
): Promise<Result<SprintLeadCycleTimeResult>> {
  // MT5: Prefetch all changelogs in a single batch request to avoid N+1
  if (stories.length > 0) {
    const keys = stories.map((s) => s.key);
    const batchJql = `key in (${keys.join(',')})`;
    await jiraClient.getIssuesWithChangelogByJQL(batchJql, `batch-changelog:${keys.join(',')}`);
  }

  // In AI mode, fetch the first AI comment date per issue to use as cycleDevTime end point
  const aiCommentDates: Map<string, string | null> = new Map();
  if (aiMode) {
    const dateResults = await Promise.all(
      stories.map(async (s) => ({
        key: s.key,
        date: await jiraClient.findFirstAICommentDate(s.key),
      })),
    );
    for (const { key, date } of dateResults) {
      aiCommentDates.set(key, date);
    }
  }

  const issueResults = await Promise.all(
    stories.map((s) => calculateLeadCycleTime(
      jiraClient,
      s.key,
      undefined,
      aiMode ? (aiCommentDates.get(s.key) ?? null) : undefined,
    )),
  );

  const issueDetails = issueResults
    .filter((r) => r.success)
    .map((r) => (r as Extract<typeof r, { success: true }>).data);

  const leadValues = issueDetails.filter((d) => d.leadTimeHours !== null).map((d) => d.leadTimeHours!);
  const cycleValues = issueDetails.filter((d) => d.cycleTimeHours !== null).map((d) => d.cycleTimeHours!);
  const cycleDevValues = issueDetails.filter((d) => d.cycleDevTimeHours !== null).map((d) => d.cycleDevTimeHours!);
  const pickupValues = issueDetails.filter((d) => d.pickupTimeHours !== null).map((d) => d.pickupTimeHours!);
  const devActiveValues = issueDetails.filter((d) => d.devActiveTimeHours !== null).map((d) => d.devActiveTimeHours!);
  const crValues = issueDetails.filter((d) => d.codeReviewTimeHours !== null).map((d) => d.codeReviewTimeHours!);

  return success({
    sprintId: 0,
    sprintName: periodLabel,
    leadTime: timeStats(leadValues),
    cycleTime: timeStats(cycleValues),
    cycleDevTime: timeStats(cycleDevValues),
    pickupTime: timeStats(pickupValues),
    devActiveTime: timeStats(devActiveValues),
    codeReviewTime: timeStats(crValues),
    issueDetails,
    wipCount: issueDetails.filter((d) => d.isWIP).length,
  });
}

// ---------------------------------------------------------------------------
// Kanban Bugs per US
// ---------------------------------------------------------------------------

export async function calculateKanbanBugs(
  allIssues: JiraIssue[],
  periodLabel: string,
): Promise<Result<SprintBugsResult>> {
  const userStories = allIssues.filter(isUserStory);
  const projectBugs = allIssues.filter((i) => isBugType(i.fields.issuetype.name));

  const issueDetails: USBugResult[] = [];

  for (const us of userStories) {
    const bugs: BugDetail[] = [];

    // From issuelinks
    for (const link of us.fields.issuelinks) {
      const linked = link.inwardIssue ?? link.outwardIssue;
      if (linked && isBugType(linked.fields.issuetype.name)) {
        bugs.push(buildBugDetail(
          linked.key, linked.fields.summary, linked.fields.priority.name,
          linked.fields.status.name, '', null, us.key, 'issue_link',
        ));
      }
    }

    // From subtasks
    for (const subtask of us.fields.subtasks) {
      if (isBugType(subtask.fields.issuetype.name)) {
        bugs.push(buildBugDetail(
          subtask.key, subtask.fields.summary, 'Minor',
          subtask.fields.status.name, '', null, us.key, 'subtask',
        ));
      }
    }

    // From period bugs matching same component
    const usComponents = new Set(us.fields.components.map((c) => c.name));
    if (usComponents.size > 0) {
      for (const bug of projectBugs) {
        const bugComponents = bug.fields.components.map((c) => c.name);
        if (bugComponents.some((c) => usComponents.has(c))) {
          bugs.push(buildBugDetail(
            bug.key, bug.fields.summary, bug.fields.priority.name,
            bug.fields.status.name, bug.fields.created, bug.fields.resolutiondate,
            us.key, 'same_sprint_component',
          ));
        }
      }
    }

    const dedupedBugs = deduplicateBugs(bugs);
    const activeBugs = dedupedBugs.filter((b) => b.status === 'open' || b.status === 'in_progress').length;
    const resolvedBugs = dedupedBugs.filter((b) => b.status === 'resolved' || b.status === 'closed').length;

    const bugsBySeverity = { blocker: 0, critical: 0, major: 0, minor: 0 };
    let weightedBugScore = 0;
    for (const bug of dedupedBugs) {
      bugsBySeverity[bug.severity]++;
      weightedBugScore += bug.weightedScore;
    }

    issueDetails.push({
      issueKey: us.key,
      summary: us.fields.summary,
      totalBugs: dedupedBugs.length,
      activeBugs,
      resolvedBugs,
      bugs: dedupedBugs,
      weightedBugScore,
      bugsBySeverity,
    });
  }

  // Aggregation
  let totalBugs = 0;
  let totalActiveBugs = 0;
  let totalResolvedBugs = 0;
  const severityDistribution = { blocker: 0, critical: 0, major: 0, minor: 0 };

  for (const detail of issueDetails) {
    totalBugs += detail.totalBugs;
    totalActiveBugs += detail.activeBugs;
    totalResolvedBugs += detail.resolvedBugs;
    severityDistribution.blocker += detail.bugsBySeverity.blocker;
    severityDistribution.critical += detail.bugsBySeverity.critical;
    severityDistribution.major += detail.bugsBySeverity.major;
    severityDistribution.minor += detail.bugsBySeverity.minor;
  }

  const doneUSCount = userStories.filter((us) => isDoneStatus(us.fields.status.name)).length;
  const bugsPerUSRatio = doneUSCount > 0 ? totalBugs / doneUSCount : null;
  const activeBugsPerUSRatio = doneUSCount > 0 ? totalActiveBugs / doneUSCount : null;

  const topBuggyUS = [...issueDetails].sort((a, b) => b.totalBugs - a.totalBugs).slice(0, 5);

  return success({
    sprintId: 0,
    sprintName: periodLabel,
    totalBugs,
    totalActiveBugs,
    totalResolvedBugs,
    bugsPerUSRatio,
    activeBugsPerUSRatio,
    topBuggyUS,
    severityDistribution,
    issueDetails,
  });
}

// ---------------------------------------------------------------------------
// Kanban Dev Ranking
// ---------------------------------------------------------------------------

interface DevAccumulator {
  displayName: string;
  usCount: number;
  usDone: number;
  storyPoints: number;
  leadTimeValues: number[];
  cycleDevTimeValues: number[];
  mrIterationValues: number[];
  totalBugs: number;
}

export async function calculateKanbanDevRanking(
  jiraClient: JiraClient,
  stories: JiraIssue[],
  allIssues: JiraIssue[],
  periodLabel: string,
): Promise<Result<SprintDevRankingResult>> {
  const devMap = new Map<string, DevAccumulator>();

  const results = await Promise.all(
    stories.map(async (issue) => {
      const assigneeName = issue.fields.assignee?.displayName ?? 'Non assigné';
      const [leadResult, mrResult] = await Promise.all([
        calculateLeadCycleTime(jiraClient, issue.key),
        calculateMRIterations(jiraClient, issue.key),
      ]);

      // Count linked bugs from pre-loaded data
      let bugCount = 0;
      for (const link of issue.fields.issuelinks) {
        const linked = link.inwardIssue ?? link.outwardIssue;
        if (linked && isBugType(linked.fields.issuetype.name)) bugCount++;
      }
      for (const subtask of issue.fields.subtasks) {
        if (isBugType(subtask.fields.issuetype.name)) bugCount++;
      }

      return { issue, assigneeName, leadResult, mrResult, bugCount };
    }),
  );

  for (const { issue, assigneeName, leadResult, mrResult, bugCount } of results) {
    if (!devMap.has(assigneeName)) {
      devMap.set(assigneeName, {
        displayName: assigneeName,
        usCount: 0, usDone: 0, storyPoints: 0,
        leadTimeValues: [], cycleDevTimeValues: [],
        mrIterationValues: [], totalBugs: 0,
      });
    }

    const acc = devMap.get(assigneeName)!;
    acc.usCount++;
    if (isDoneStatus(issue.fields.status.name)) acc.usDone++;
    const sp = (issue.fields.story_points as number) ?? 0;
    acc.storyPoints += sp;

    if (leadResult.success) {
      if (leadResult.data.leadTimeHours !== null) acc.leadTimeValues.push(leadResult.data.leadTimeHours);
      if (leadResult.data.cycleDevTimeHours !== null) acc.cycleDevTimeValues.push(leadResult.data.cycleDevTimeHours);
    }
    if (mrResult.success && mrResult.data.iterationsCount !== null) {
      acc.mrIterationValues.push(mrResult.data.iterationsCount);
    }
    acc.totalBugs += bugCount;
  }

  // Compute scores (same logic as sprint version)
  const devs = [...devMap.values()];
  const stats: DevStats[] = devs.map((d) => {
    const avgLead = d.leadTimeValues.length > 0 ? d.leadTimeValues.reduce((a, b) => a + b, 0) / d.leadTimeValues.length : null;
    const avgCycleDev = d.cycleDevTimeValues.length > 0 ? d.cycleDevTimeValues.reduce((a, b) => a + b, 0) / d.cycleDevTimeValues.length : null;
    const avgMR = d.mrIterationValues.length > 0 ? d.mrIterationValues.reduce((a, b) => a + b, 0) / d.mrIterationValues.length : null;
    const bugsPerUS = d.usCount > 0 ? d.totalBugs / d.usCount : null;
    return {
      displayName: d.displayName,
      usCount: d.usCount, usDone: d.usDone,
      totalStoryPoints: d.storyPoints > 0 ? d.storyPoints : null,
      avgLeadTimeHours: avgLead !== null ? round1(avgLead) : null,
      avgCycleDevTimeHours: avgCycleDev !== null ? round1(avgCycleDev) : null,
      avgMRIterations: avgMR !== null ? round1(avgMR) : null,
      totalBugs: d.totalBugs,
      bugsPerUS: bugsPerUS !== null ? Math.round(bugsPerUS * 100) / 100 : null,
      score: 0,
    };
  });

  const avgOfAll = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 1;
  const allLead = stats.filter((s) => s.avgLeadTimeHours !== null).map((s) => s.avgLeadTimeHours!);
  const allCycle = stats.filter((s) => s.avgCycleDevTimeHours !== null).map((s) => s.avgCycleDevTimeHours!);
  const allMR = stats.filter((s) => s.avgMRIterations !== null).map((s) => s.avgMRIterations!);
  const allBugs = stats.filter((s) => s.bugsPerUS !== null).map((s) => s.bugsPerUS!);

  const sAvgLead = avgOfAll(allLead);
  const sAvgCycle = avgOfAll(allCycle);
  const sAvgMR = avgOfAll(allMR);
  const sAvgBugs = avgOfAll(allBugs);

  for (const dev of stats) {
    const leadRatio = dev.avgLeadTimeHours !== null && sAvgLead > 0 ? dev.avgLeadTimeHours / sAvgLead : 1;
    const cycleRatio = dev.avgCycleDevTimeHours !== null && sAvgCycle > 0 ? dev.avgCycleDevTimeHours / sAvgCycle : 1;
    const mrRatio = dev.avgMRIterations !== null && sAvgMR > 0 ? dev.avgMRIterations / sAvgMR : 1;
    const bugRatio = dev.bugsPerUS !== null && sAvgBugs > 0 ? dev.bugsPerUS / sAvgBugs : 1;
    const completionRatio = dev.usCount > 0 ? dev.usDone / dev.usCount : 0;
    const penalty = (leadRatio * 0.25) + (cycleRatio * 0.2) + (mrRatio * 0.2) + (bugRatio * 0.2);
    const bonus = completionRatio * 0.15;
    dev.score = Math.round(Math.max(0, Math.min(100, (1 - penalty + bonus + 0.85) * 50)));
  }

  stats.sort((a, b) => b.score - a.score);

  return success({
    sprintId: 0,
    sprintName: periodLabel,
    developers: stats,
  });
}

// ---------------------------------------------------------------------------
// Kanban All KPIs (single aggregate call)
// ---------------------------------------------------------------------------

export interface KanbanAllKPIResponse {
  periodLabel: string;
  startDate: string;
  endDate: string;
  exportDate: string;
  completionRate: USCompletionRateResult | null;
  mrIterations: SprintMRIterationsResult | null;
  leadCycleTime: SprintLeadCycleTimeResult | null;
  bugs: SprintBugsResult | null;
  errors: Array<{ kpi: string; error: { code: string; message: string } }>;
}

export async function calculateKanbanAllKPIs(
  jiraClient: JiraClient,
  projectKey: string,
  startDate: string,
  endDate: string,
  preloadedIssues?: JiraIssue[],
  overridePeriodLabel?: string,
  aiMode = false,
): Promise<Result<KanbanAllKPIResponse>> {
  let allIssues: JiraIssue[];

  if (preloadedIssues) {
    allIssues = preloadedIssues;
  } else {
    const issuesResult = await jiraClient.getKanbanIssues(projectKey, startDate, endDate);
    if (!issuesResult.success) return issuesResult;
    allIssues = issuesResult.data;
  }

  const stories = allIssues.filter(isUserStory);
  const periodLabel = overridePeriodLabel ?? `${startDate} → ${endDate}`;
  const serviceAccount = jiraClient.getConfig().workflowServiceAccount;

  const [completionRate, mrIterations, leadCycleTime, bugs] = await Promise.all([
    calculateKanbanCompletionRate(jiraClient, stories, periodLabel, serviceAccount),
    calculateKanbanMRIterations(jiraClient, stories, periodLabel),
    calculateKanbanLeadCycleTime(jiraClient, stories, periodLabel, aiMode),
    calculateKanbanBugs(allIssues, periodLabel),
  ]);

  return success({
    periodLabel,
    startDate,
    endDate,
    exportDate: new Date().toISOString(),
    completionRate: completionRate.success ? completionRate.data : null,
    mrIterations: mrIterations.success ? mrIterations.data : null,
    leadCycleTime: leadCycleTime.success ? leadCycleTime.data : null,
    bugs: bugs.success ? bugs.data : null,
    errors: [
      ...(!completionRate.success ? [{ kpi: 'completion-rate', error: completionRate.error }] : []),
      ...(!mrIterations.success ? [{ kpi: 'mr-iterations', error: mrIterations.error }] : []),
      ...(!leadCycleTime.success ? [{ kpi: 'lead-cycle-time', error: leadCycleTime.error }] : []),
      ...(!bugs.success ? [{ kpi: 'bugs', error: bugs.error }] : []),
    ],
  });
}
