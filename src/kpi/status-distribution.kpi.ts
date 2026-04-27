import { JiraClient } from '../clients/jira-client';
import {
  isDoneStatus,
  isInProgressStatus,
  isReviewStatus,
  isBlockedStatus,
  isReadyStatus,
} from '../config/workflow-statuses.config';
import { isUserStory } from '../types/jira.types';
import type { JiraIssue } from '../types/jira.types';
import type { StatusDistributionResult, StatusCount } from '../types/kpi.types';
import type { Result } from '../types/result.types';
import { success } from '../types/result.types';

function categorize(statusName: string): StatusCount['category'] {
  if (isDoneStatus(statusName)) return 'done';
  if (isReviewStatus(statusName)) return 'review';
  if (isInProgressStatus(statusName)) return 'in_progress';
  if (isBlockedStatus(statusName)) return 'blocked';
  if (isReadyStatus(statusName)) return 'todo';
  return 'other';
}

function buildDistribution(stories: JiraIssue[], periodLabel: string): StatusDistributionResult {
  const statusMap = new Map<string, { category: StatusCount['category']; count: number }>();

  for (const story of stories) {
    const statusName = story.fields.status.name;
    const existing = statusMap.get(statusName);
    if (existing) {
      existing.count++;
    } else {
      statusMap.set(statusName, { category: categorize(statusName), count: 1 });
    }
  }

  const statuses: StatusCount[] = [...statusMap.entries()]
    .map(([status, { category, count }]) => ({ status, category, count }))
    .sort((a, b) => b.count - a.count);

  const byCategoryCount = { done: 0, in_progress: 0, review: 0, todo: 0, blocked: 0, other: 0 };
  for (const s of statuses) {
    byCategoryCount[s.category] += s.count;
  }

  return {
    periodLabel,
    totalUS: stories.length,
    statuses,
    byCategoryCount,
  };
}

export async function calculateStatusDistribution(
  jiraClient: JiraClient,
  sprintId: number,
): Promise<Result<StatusDistributionResult>> {
  const storiesResult = await jiraClient.getSprintUserStories(sprintId);
  if (!storiesResult.success) return storiesResult;

  return success(buildDistribution(storiesResult.data, `Sprint ${sprintId}`));
}

export async function calculateKanbanStatusDistribution(
  jiraClient: JiraClient,
  projectKey: string,
  startDate: string,
  endDate: string,
): Promise<Result<StatusDistributionResult>> {
  const issuesResult = await jiraClient.getKanbanIssues(projectKey, startDate, endDate);
  if (!issuesResult.success) return issuesResult;

  const stories = issuesResult.data.filter(isUserStory);
  return success(buildDistribution(stories, `${startDate} → ${endDate}`));
}
