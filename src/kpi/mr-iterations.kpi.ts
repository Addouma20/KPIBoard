import type { JiraIssue, JiraChangelogHistory } from '../types';
import type {
  MRIterationsResult,
  SprintMRIterationsResult,
  ReviewTransition,
  IterationDistribution,
} from '../types';
import { Result, success, failure } from '../types/result.types';
import { JiraClient } from '../clients/jira-client';
import { REVIEW_STATUSES, IN_PROGRESS_STATUSES } from '../config/workflow-statuses.config';
import { average, median, max } from '../utils/stats';

/**
 * Extract review transitions from an issue's changelog.
 * A review transition = moving FROM an "In Review" status
 * TO a "Changes Requested" or "In Progress" (rework) status.
 */
function extractReviewTransitions(histories: JiraChangelogHistory[]): ReviewTransition[] {
  const reworkStatuses = [...REVIEW_STATUSES.changesRequested, ...IN_PROGRESS_STATUSES];
  const transitions: ReviewTransition[] = [];

  for (const history of histories) {
    for (const item of history.items) {
      if (item.field !== 'status') continue;

      const fromStatus = (item.fromString ?? '').toLowerCase();
      const toStatus = (item.toString ?? '').toLowerCase();

      const isFromReview = REVIEW_STATUSES.inReview.includes(fromStatus);
      const isToRework = reworkStatuses.includes(toStatus);

      if (isFromReview && isToRework) {
        transitions.push({
          from: fromStatus,
          to: toStatus,
          date: history.created,
          author: history.author.displayName,
        });
      }
    }
  }

  return transitions;
}

/**
 * Try reading the iterations count from a custom field on the issue.
 */
function tryCustomField(issue: JiraIssue, fieldName: string): number | null {
  const value = issue.fields[fieldName];
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/**
 * Calculate MR iterations for a single issue.
 * Priority: custom field > changelog transitions > unavailable.
 */
export async function calculateMRIterations(
  jiraClient: JiraClient,
  issueKey: string,
): Promise<Result<MRIterationsResult>> {
  const issueResult = await jiraClient.getIssueWithChangelog(issueKey);
  if (!issueResult.success) return issueResult;

  const issue = issueResult.data;
  const customFieldName = jiraClient.getConfig().iterationsCustomField;

  // 1. Try custom field first
  const customValue = tryCustomField(issue, customFieldName);
  if (customValue !== null) {
    return success({
      issueKey,
      iterationsCount: customValue,
      dataSource: 'custom_field',
      reviewTransitions: [],
    });
  }

  // 2. Fallback: count transitions from changelog
  const histories = issue.changelog?.histories ?? [];
  const reviewTransitions = extractReviewTransitions(histories);

  // Check if there were any review-related status changes at all
  const hasAnyReviewActivity = histories.some((h) =>
    h.items.some(
      (item) =>
        item.field === 'status' &&
        (REVIEW_STATUSES.inReview.includes((item.fromString ?? '').toLowerCase()) ||
          REVIEW_STATUSES.inReview.includes((item.toString ?? '').toLowerCase())),
    ),
  );

  if (!hasAnyReviewActivity) {
    return success({
      issueKey,
      iterationsCount: null,
      dataSource: 'unavailable',
      reviewTransitions: [],
    });
  }

  // Each rework transition = 1 iteration; if went through review with 0 rework = 1 iteration
  const iterationsCount = reviewTransitions.length === 0 ? 1 : reviewTransitions.length + 1;

  return success({
    issueKey,
    iterationsCount,
    dataSource: 'status_transitions',
    reviewTransitions,
  });
}

/**
 * Calculate MR iteration KPIs for an entire sprint.
 */
export async function calculateSprintMRIterations(
  jiraClient: JiraClient,
  sprintId: number,
): Promise<Result<SprintMRIterationsResult>> {
  const sprintsResult = await jiraClient.getSprints(0);
  let sprintName = `Sprint ${sprintId}`;

  if (sprintsResult.success) {
    const sprint = sprintsResult.data.find((s) => s.id === sprintId);
    if (sprint) sprintName = sprint.name;
  }

  const storiesResult = await jiraClient.getSprintUserStories(sprintId);
  if (!storiesResult.success) return storiesResult;

  const stories = storiesResult.data;
  const issueDetails: MRIterationsResult[] = [];

  for (const story of stories) {
    const result = await calculateMRIterations(jiraClient, story.key);
    if (!result.success) return result;
    issueDetails.push(result.data);
  }

  // Filter out unavailable for numeric stats
  const availableCounts = issueDetails
    .filter((d) => d.iterationsCount !== null)
    .map((d) => d.iterationsCount as number);

  const distribution: IterationDistribution = {
    oneIteration: issueDetails.filter((d) => d.iterationsCount === 1).length,
    twoIterations: issueDetails.filter((d) => d.iterationsCount === 2).length,
    threeOrMore: issueDetails.filter((d) => d.iterationsCount !== null && d.iterationsCount >= 3).length,
    unavailable: issueDetails.filter((d) => d.iterationsCount === null).length,
  };

  return success({
    sprintId,
    sprintName,
    averageIterations: average(availableCounts),
    medianIterations: median(availableCounts),
    maxIterations: max(availableCounts),
    distribution,
    issueDetails,
  });
}
