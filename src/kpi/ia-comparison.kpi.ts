/**
 * QW5: IA vs Non-IA comparison
 * MT4: Management ROI view
 */
import { JiraClient } from '../clients/jira-client';
import { isUserStory } from '../types/jira.types';
import { calculateKanbanAllKPIs } from './kanban-kpi';
import { calculateLeadCycleTime, DEFAULT_OPTIONS } from './lead-cycle-time.kpi';
import { generateAllInsights } from './insights';
import { assessDataQuality } from '../utils/data-quality';
import type {
  IAComparisonResult,
  IAComparisonMetrics,
  IAUSDetailResult,
  USDevDetailRow,
  ROIMetrics,
  Insight,
} from '../types/kpi.types';
import type { JiraIssue } from '../types/jira.types';
import type { Result } from '../types/result.types';
import { success } from '../types/result.types';

function buildMetrics(
  data: Awaited<ReturnType<typeof calculateKanbanAllKPIs>> extends Result<infer T> ? T : never,
): IAComparisonMetrics {
  const lr = data.leadCycleTime;
  const mr = data.mrIterations;
  const bugs = data.bugs;
  const cr = data.completionRate;

  return {
    avgLeadTimeHours: lr?.leadTime.averageHours ?? null,
    avgCycleDevTimeHours: lr?.cycleDevTime.averageHours ?? null,
    avgPickupTimeHours: lr?.pickupTime?.averageHours ?? null,
    avgDevActiveTimeHours: lr?.devActiveTime?.averageHours ?? null,
    avgMRIterations: mr?.averageIterations ?? null,
    avgReworkCount: mr?.averageReworkCount ?? null,
    totalReworkCount: mr?.totalReworkCount ?? null,
    totalMRWithReviewData: mr
      ? mr.distribution.oneIteration + mr.distribution.twoIterations + mr.distribution.threeOrMore
      : null,
    bugsPerUSRatio: bugs?.bugsPerUSRatio ?? null,
    firstTimeRightPercent: mr?.firstTimeRightPercent ?? null,
    completionRatePercent: cr?.completionRatePercent ?? null,
    totalUS: cr?.totalUS ?? 0,
    cycleDevUSCount: lr?.cycleDevTime.sampleSize ?? null,
    avgStoryPoints: null, // Available when story_points custom field is configured
  };
}

function deltaPercent(a: number | null, b: number | null): number | null {
  if (a === null || b === null || b === 0) return null;
  return Math.round(((a - b) / b) * 1000) / 10;
}

export async function calculateIAComparison(
  jiraClient: JiraClient,
  projectKey: string,
  startDate: string,
  endDate: string,
): Promise<Result<IAComparisonResult>> {
  // Get all issues for the period
  const allIssuesResult = await jiraClient.getKanbanIssues(projectKey, startDate, endDate);
  if (!allIssuesResult.success) return allIssuesResult;
  const allIssues = allIssuesResult.data;

  // Get AI-flagged issues
  const aiIssuesResult = await jiraClient.getAIAgentIssues({ projectKey, startDate, endDate });
  if (!aiIssuesResult.success) return aiIssuesResult;
  const aiIssueKeys = new Set(aiIssuesResult.data.map((i) => i.key));

  // Split issues into IA and non-IA sets
  const iaIssues = allIssues.filter((i) => aiIssueKeys.has(i.key));
  const nonIAIssues = allIssues.filter((i) => !aiIssueKeys.has(i.key));

  const periodLabel = `${startDate} → ${endDate}`;

  // Calculate KPIs for each set
  const [iaResult, nonIAResult] = await Promise.all([
    calculateKanbanAllKPIs(jiraClient, projectKey, startDate, endDate, iaIssues, `${periodLabel} — IA`, true),
    calculateKanbanAllKPIs(jiraClient, projectKey, startDate, endDate, nonIAIssues, `${periodLabel} — Non-IA`),
  ]);

  if (!iaResult.success) return iaResult;
  if (!nonIAResult.success) return nonIAResult;

  const ia = buildMetrics(iaResult.data);
  const nonIA = buildMetrics(nonIAResult.data);

  const deltas = {
    leadTimeDeltaPercent: deltaPercent(ia.avgLeadTimeHours, nonIA.avgLeadTimeHours),
    cycleDevTimeDeltaPercent: deltaPercent(ia.avgCycleDevTimeHours, nonIA.avgCycleDevTimeHours),
    pickupTimeDeltaPercent: deltaPercent(ia.avgPickupTimeHours, nonIA.avgPickupTimeHours),
    devActiveTimeDeltaPercent: deltaPercent(ia.avgDevActiveTimeHours, nonIA.avgDevActiveTimeHours),
    mrIterationsDeltaPercent: deltaPercent(ia.avgMRIterations, nonIA.avgMRIterations),
    bugsPerUSDeltaPercent: deltaPercent(ia.bugsPerUSRatio, nonIA.bugsPerUSRatio),
    firstTimeRightDeltaPercent: deltaPercent(ia.firstTimeRightPercent, nonIA.firstTimeRightPercent),
  };

  // Generate comparison insights
  const insights: Insight[] = [];
  if (deltas.cycleDevTimeDeltaPercent !== null && deltas.cycleDevTimeDeltaPercent < -10) {
    insights.push({
      id: 'ia-cycle-faster', severity: 'success', category: 'ai',
      message: `Les US assistées par IA ont un Cycle Dev ${Math.abs(deltas.cycleDevTimeDeltaPercent)}% plus rapide.`,
      metric: 'cycleDevTimeDelta', value: deltas.cycleDevTimeDeltaPercent, delta: deltas.cycleDevTimeDeltaPercent,
    });
  }
  if (deltas.mrIterationsDeltaPercent !== null && deltas.mrIterationsDeltaPercent < -10) {
    insights.push({
      id: 'ia-mr-better', severity: 'success', category: 'ai',
      message: `Les US assistées par IA nécessitent ${Math.abs(deltas.mrIterationsDeltaPercent)}% moins d'itérations MR.`,
      metric: 'mrIterationsDelta', value: deltas.mrIterationsDeltaPercent, delta: deltas.mrIterationsDeltaPercent,
    });
  }
  if (deltas.bugsPerUSDeltaPercent !== null && deltas.bugsPerUSDeltaPercent > 20) {
    insights.push({
      id: 'ia-bugs-more', severity: 'warning', category: 'ai',
      message: `Les US assistées par IA génèrent ${deltas.bugsPerUSDeltaPercent}% plus de bugs — qualité à surveiller.`,
      metric: 'bugsPerUSDelta', value: deltas.bugsPerUSDeltaPercent, delta: deltas.bugsPerUSDeltaPercent,
    });
  }

  const stories = allIssues.filter(isUserStory);
  const dataQuality = assessDataQuality(
    stories.length,
    0,
    stories.length - iaIssues.filter(isUserStory).length - nonIAIssues.filter(isUserStory).length,
  );

  return success({
    periodLabel,
    ia,
    nonIA,
    deltas,
    insights,
    dataQuality,
  });
}

export async function calculateROIMetrics(
  jiraClient: JiraClient,
  projectKey: string,
  startDate: string,
  endDate: string,
): Promise<Result<ROIMetrics>> {
  const compResult = await calculateIAComparison(jiraClient, projectKey, startDate, endDate);
  if (!compResult.success) return compResult;

  const { ia, nonIA, periodLabel } = compResult.data;
  const totalUS = ia.totalUS + nonIA.totalUS;
  const iaAdoptionPercent = totalUS > 0 ? Math.round((ia.totalUS / totalUS) * 1000) / 10 : 0;

  let estimatedDaysSaved: number | null = null;
  if (ia.avgCycleDevTimeHours !== null && nonIA.avgCycleDevTimeHours !== null && ia.totalUS > 0) {
    const hoursSavedPerUS = nonIA.avgCycleDevTimeHours - ia.avgCycleDevTimeHours;
    if (hoursSavedPerUS > 0) {
      estimatedDaysSaved = Math.round((hoursSavedPerUS * ia.totalUS) / 9 * 10) / 10;
    }
  }

  const avgCycleDevReductionPercent = compResult.data.deltas.cycleDevTimeDeltaPercent !== null
    ? -compResult.data.deltas.cycleDevTimeDeltaPercent
    : null;
  const avgLeadTimeReductionPercent = compResult.data.deltas.leadTimeDeltaPercent !== null
    ? -compResult.data.deltas.leadTimeDeltaPercent
    : null;

  return success({
    periodLabel,
    totalUS,
    iaUS: ia.totalUS,
    nonIAUS: nonIA.totalUS,
    iaAdoptionPercent,
    estimatedDaysSaved,
    avgCycleDevReductionPercent: avgCycleDevReductionPercent !== null ? Math.round(avgCycleDevReductionPercent * 10) / 10 : null,
    avgLeadTimeReductionPercent: avgLeadTimeReductionPercent !== null ? Math.round(avgLeadTimeReductionPercent * 10) / 10 : null,
    iaFirstTimeRightPercent: ia.firstTimeRightPercent,
    nonIAFirstTimeRightPercent: nonIA.firstTimeRightPercent,
  });
}

// ---------------------------------------------------------------------------
// US-level detail for IA vs Human cards
// ---------------------------------------------------------------------------

function extractContributors(issue: JiraIssue): string[] {
  const authors = new Set<string>();
  if (issue.changelog?.histories) {
    for (const h of issue.changelog.histories) {
      const hasStatusChange = h.items.some((i) => i.field === 'status');
      if (hasStatusChange) {
        authors.add(h.author.displayName);
      }
    }
  }
  if (issue.fields.assignee) {
    authors.add(issue.fields.assignee.displayName);
  }
  return [...authors];
}

function buildUSDetailRow(
  issue: JiraIssue,
  cycleDevTimeHours: number | null,
  reviewBackAndForthCount: number | null,
): USDevDetailRow {
  return {
    key: issue.key,
    summary: issue.fields.summary,
    status: issue.fields.status.name,
    cycleDevTimeHours,
    cycleDevTimeDays: cycleDevTimeHours !== null ? Math.round((cycleDevTimeHours / 9) * 10) / 10 : null,
    storyPoints: issue.fields.story_points ?? null,
    assignee: issue.fields.assignee?.displayName ?? 'Non assigné',
    contributors: extractContributors(issue),
    reviewBackAndForthCount,
  };
}

async function buildUSDetails(
  jiraClient: JiraClient,
  issues: JiraIssue[],
  isIA: boolean,
): Promise<USDevDetailRow[]> {
  const stories = issues.filter(isUserStory);

  const details = await Promise.all(
    stories.map(async (issue) => {
      const leadResult = await calculateLeadCycleTime(jiraClient, issue.key, { ...DEFAULT_OPTIONS, isIA });
      const cycleDevTimeHours = leadResult.success ? leadResult.data.cycleDevTimeHours : null;
      const reviewBackAndForthCount = leadResult.success ? leadResult.data.reviewBackAndForthCount : null;
      return buildUSDetailRow(issue, cycleDevTimeHours, reviewBackAndForthCount);
    }),
  );

  return details;
}

export async function calculateIAUSDetails(
  jiraClient: JiraClient,
  scope: { sprintId: number } | { projectKey: string; startDate: string; endDate: string },
): Promise<Result<IAUSDetailResult>> {
  let allIssues: JiraIssue[];
  let periodLabel: string;

  if ('sprintId' in scope) {
    const result = await jiraClient.getSprintIssues(scope.sprintId);
    if (!result.success) return result;
    allIssues = result.data;
    periodLabel = `Sprint ${scope.sprintId}`;
  } else {
    const result = await jiraClient.getKanbanIssues(scope.projectKey, scope.startDate, scope.endDate);
    if (!result.success) return result;
    allIssues = result.data;
    periodLabel = `${scope.startDate} → ${scope.endDate}`;
  }

  const aiIssuesResult = await jiraClient.getAIAgentIssues(
    'sprintId' in scope ? { sprintId: scope.sprintId } : { projectKey: scope.projectKey, startDate: scope.startDate, endDate: scope.endDate },
  );
  if (!aiIssuesResult.success) return aiIssuesResult;
  const aiIssueKeys = new Set(aiIssuesResult.data.map((i) => i.key));

  const iaIssues = allIssues.filter((i) => aiIssueKeys.has(i.key));
  const nonIAIssues = allIssues.filter((i) => !aiIssueKeys.has(i.key));

  const [iaDetails, nonIADetails] = await Promise.all([
    buildUSDetails(jiraClient, iaIssues, true),
    buildUSDetails(jiraClient, nonIAIssues, false),
  ]);

  return success({
    periodLabel,
    iaIssues: iaDetails,
    nonIAIssues: nonIADetails,
  });
}
