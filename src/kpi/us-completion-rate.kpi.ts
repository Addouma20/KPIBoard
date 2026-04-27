import { JiraClient } from '../clients/jira-client';
import { isDoneStatus } from '../config/workflow-statuses.config';
import type { USCompletionRateResult, SprintKPIPoint } from '../types/kpi.types';
import type { JiraChangelogHistory } from '../types/jira.types';
import type { Result } from '../types/result.types';
import { success } from '../types/result.types';

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function findLastDoneTransitionAuthor(
  histories: JiraChangelogHistory[],
): string | null {
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

export async function calculateUSCompletionRate(
  jiraClient: JiraClient,
  sprintId: number,
  workflowServiceAccount: string,
): Promise<Result<USCompletionRateResult>> {
  const storiesResult = await jiraClient.getSprintUserStories(sprintId);
  if (!storiesResult.success) return storiesResult;

  const stories = storiesResult.data;
  const totalUS = stories.length;

  if (totalUS === 0) {
    return success({
      sprintId,
      sprintName: '',
      totalUS: 0,
      doneByWorkflow: 0,
      doneManually: 0,
      remaining: 0,
      completionRatePercent: 0,
      workflowRatePercent: 0,
    });
  }

  let doneByWorkflow = 0;
  let doneManually = 0;

  for (const story of stories) {
    if (!isDoneStatus(story.fields.status.name)) continue;

    const changelogResult = await jiraClient.getIssueWithChangelog(story.key);
    if (!changelogResult.success) return changelogResult;

    const changelog = changelogResult.data.changelog;
    if (!changelog) {
      doneManually++;
      continue;
    }

    const author = findLastDoneTransitionAuthor(changelog.histories);
    if (author === workflowServiceAccount) {
      doneByWorkflow++;
    } else {
      doneManually++;
    }
  }

  const remaining = totalUS - doneByWorkflow - doneManually;
  const totalDone = doneByWorkflow + doneManually;
  const completionRatePercent = round1((totalDone / totalUS) * 100);
  const workflowRatePercent = totalDone > 0
    ? round1((doneByWorkflow / totalDone) * 100)
    : 0;

  return success({
    sprintId,
    sprintName: '',
    totalUS,
    doneByWorkflow,
    doneManually,
    remaining,
    completionRatePercent,
    workflowRatePercent,
  });
}

export async function getSprintHistory(
  jiraClient: JiraClient,
  boardId: number,
  lastNSprints = 5,
  workflowServiceAccount = '',
): Promise<Result<SprintKPIPoint[]>> {
  const sprintsResult = await jiraClient.getSprints(boardId, 'closed');
  if (!sprintsResult.success) return sprintsResult;

  const closedSprints = sprintsResult.data
    .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());

  const lastSprints = closedSprints.slice(-lastNSprints);
  const points: SprintKPIPoint[] = [];

  for (const sprint of lastSprints) {
    const rateResult = await calculateUSCompletionRate(
      jiraClient, sprint.id, workflowServiceAccount,
    );
    if (!rateResult.success) return rateResult;

    const rate = rateResult.data;
    const totalDone = rate.doneByWorkflow + rate.doneManually;

    points.push({
      sprintId: sprint.id,
      sprintName: sprint.name,
      endDate: sprint.endDate,
      completionRatePercent: rate.totalUS === 0 ? null : rate.completionRatePercent,
      workflowRatePercent: rate.totalUS === 0 ? null : rate.workflowRatePercent,
      totalUS: rate.totalUS,
      doneUS: totalDone,
    });
  }

  return success(points);
}
