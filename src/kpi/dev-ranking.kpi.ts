import { JiraClient } from '../clients/jira-client';
import type { DevStats, SprintDevRankingResult } from '../types/kpi.types';
import type { Result } from '../types/result.types';
import { success } from '../types/result.types';
import { calculateLeadCycleTime } from './lead-cycle-time.kpi';
import { calculateMRIterations } from './mr-iterations.kpi';
import { getBugsForIssue } from './bugs-per-us.kpi';
import { isDoneStatus } from '../config/workflow-statuses.config';

const BUSINESS_HOURS_PER_DAY = 9;

interface DevAccumulator {
  displayName: string;
  usCount: number;
  usDone: number;
  leadTimeValues: number[];
  cycleDevTimeValues: number[];
  mrIterationValues: number[];
  totalBugs: number;
}

/**
 * Score formula (lower is better):
 *  - Avg Lead Time in days (weight 30%)
 *  - Avg Cycle Dev Time in days (weight 25%)
 *  - Avg MR Iterations (weight 20%)
 *  - Bugs per US (weight 25%)
 *
 * Each metric is normalized: value / sprint average. Missing data = neutral (1.0).
 * Final score = 100 - weighted_sum * 100 (higher score = better dev).
 */
function computeScores(devs: DevAccumulator[]): DevStats[] {
  const stats = devs.map((d) => {
    const avgLead = d.leadTimeValues.length > 0
      ? d.leadTimeValues.reduce((a, b) => a + b, 0) / d.leadTimeValues.length
      : null;
    const avgCycleDev = d.cycleDevTimeValues.length > 0
      ? d.cycleDevTimeValues.reduce((a, b) => a + b, 0) / d.cycleDevTimeValues.length
      : null;
    const avgMR = d.mrIterationValues.length > 0
      ? d.mrIterationValues.reduce((a, b) => a + b, 0) / d.mrIterationValues.length
      : null;
    const bugsPerUS = d.usCount > 0 ? d.totalBugs / d.usCount : null;

    return {
      displayName: d.displayName,
      usCount: d.usCount,
      usDone: d.usDone,
      avgLeadTimeHours: avgLead !== null ? Math.round(avgLead * 10) / 10 : null,
      avgCycleDevTimeHours: avgCycleDev !== null ? Math.round(avgCycleDev * 10) / 10 : null,
      avgMRIterations: avgMR !== null ? Math.round(avgMR * 10) / 10 : null,
      totalBugs: d.totalBugs,
      bugsPerUS: bugsPerUS !== null ? Math.round(bugsPerUS * 100) / 100 : null,
      score: 0,
    };
  });

  // Compute sprint averages for normalization
  const allLead = stats.filter((s) => s.avgLeadTimeHours !== null).map((s) => s.avgLeadTimeHours!);
  const allCycle = stats.filter((s) => s.avgCycleDevTimeHours !== null).map((s) => s.avgCycleDevTimeHours!);
  const allMR = stats.filter((s) => s.avgMRIterations !== null).map((s) => s.avgMRIterations!);
  const allBugs = stats.filter((s) => s.bugsPerUS !== null).map((s) => s.bugsPerUS!);

  const avgOfAll = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 1;

  const sprintAvgLead = avgOfAll(allLead);
  const sprintAvgCycle = avgOfAll(allCycle);
  const sprintAvgMR = avgOfAll(allMR);
  const sprintAvgBugs = avgOfAll(allBugs);

  for (const dev of stats) {
    // Normalized ratios (lower is better for all metrics) — default to 1.0 (neutral) if missing
    const leadRatio = dev.avgLeadTimeHours !== null && sprintAvgLead > 0
      ? dev.avgLeadTimeHours / sprintAvgLead : 1;
    const cycleRatio = dev.avgCycleDevTimeHours !== null && sprintAvgCycle > 0
      ? dev.avgCycleDevTimeHours / sprintAvgCycle : 1;
    const mrRatio = dev.avgMRIterations !== null && sprintAvgMR > 0
      ? dev.avgMRIterations / sprintAvgMR : 1;
    const bugRatio = dev.bugsPerUS !== null && sprintAvgBugs > 0
      ? dev.bugsPerUS / sprintAvgBugs : 1;

    // Completion bonus: proportion of done US (more done = better)
    const completionRatio = dev.usCount > 0 ? dev.usDone / dev.usCount : 0;

    // Weighted penalty sum (lower = better)
    const penalty = (leadRatio * 0.25) + (cycleRatio * 0.2) + (mrRatio * 0.2) + (bugRatio * 0.2);
    // Completion bonus (higher = better)
    const bonus = completionRatio * 0.15;

    // Score: 100 = perfect, 0 = worst
    dev.score = Math.round(Math.max(0, Math.min(100, (1 - penalty + bonus + 0.85) * 50)));
  }

  // Sort by score desc
  stats.sort((a, b) => b.score - a.score);
  return stats;
}

export async function calculateSprintDevRanking(
  jiraClient: JiraClient,
  sprintId: number,
): Promise<Result<SprintDevRankingResult>> {
  const storiesResult = await jiraClient.getSprintUserStories(sprintId);
  if (!storiesResult.success) return storiesResult;

  const stories = storiesResult.data;
  const devMap = new Map<string, DevAccumulator>();

  // Process each US in parallel
  const results = await Promise.all(
    stories.map(async (issue) => {
      const assigneeName = issue.fields.assignee?.displayName ?? 'Non assigné';

      const [leadResult, mrResult, bugResult] = await Promise.all([
        calculateLeadCycleTime(jiraClient, issue.key),
        calculateMRIterations(jiraClient, issue.key),
        getBugsForIssue(jiraClient, issue.key, sprintId),
      ]);

      return { issue, assigneeName, leadResult, mrResult, bugResult };
    }),
  );

  for (const { issue, assigneeName, leadResult, mrResult, bugResult } of results) {
    if (!devMap.has(assigneeName)) {
      devMap.set(assigneeName, {
        displayName: assigneeName,
        usCount: 0,
        usDone: 0,
        leadTimeValues: [],
        cycleDevTimeValues: [],
        mrIterationValues: [],
        totalBugs: 0,
      });
    }

    const acc = devMap.get(assigneeName)!;
    acc.usCount++;

    if (isDoneStatus(issue.fields.status.name)) {
      acc.usDone++;
    }

    if (leadResult.success) {
      if (leadResult.data.leadTimeHours !== null) {
        acc.leadTimeValues.push(leadResult.data.leadTimeHours);
      }
      if (leadResult.data.cycleDevTimeHours !== null) {
        acc.cycleDevTimeValues.push(leadResult.data.cycleDevTimeHours);
      }
    }

    if (mrResult.success && mrResult.data.iterationsCount !== null) {
      acc.mrIterationValues.push(mrResult.data.iterationsCount);
    }

    if (bugResult.success) {
      acc.totalBugs += bugResult.data.length;
    }
  }

  const developers = computeScores([...devMap.values()]);

  return success({
    sprintId,
    sprintName: `Sprint ${sprintId}`,
    developers,
  });
}
