import { JiraClient } from '../clients/jira-client';
import type { JiraChangelogHistory } from '../types/jira.types';
import type {
  LeadCycleTimeResult,
  SprintLeadCycleTimeResult,
  StatusPeriod,
  CodeReviewDetail,
  LeadCycleTimeOptions,
  TimeStats,
} from '../types/kpi.types';
import { Result, success, failure } from '../types/result.types';
import {
  DONE_STATUSES,
  READY_STATUSES,
  IN_PROGRESS_STATUSES,
  REVIEW_STATUSES,
  BLOCKED_STATUSES,
  isReviewStatus,
} from '../config/workflow-statuses.config';
import { calculateBusinessHours, hoursToBusinessDays } from '../utils/business-days';
import { average, median, percentile, min, max } from '../utils/stats';

export const DEFAULT_OPTIONS: LeadCycleTimeOptions = {
  businessDaysOnly: true,
  businessHoursStart: 9,
  businessHoursEnd: 18,
  timezone: 'Europe/Paris',
  readyStatuses: READY_STATUSES,
  doneStatuses: DONE_STATUSES,
  inProgressStatuses: IN_PROGRESS_STATUSES,
  reviewStatuses: [...REVIEW_STATUSES.inReview, ...REVIEW_STATUSES.changesRequested],
  blockedStatuses: BLOCKED_STATUSES,
};

export function buildStatusTimeline(
  histories: JiraChangelogHistory[],
  options: LeadCycleTimeOptions = DEFAULT_OPTIONS
): StatusPeriod[] {
  const statusChanges: { status: string; date: string }[] = [];

  const sorted = [...histories].sort(
    (a, b) => new Date(a.created).getTime() - new Date(b.created).getTime()
  );

  for (const history of sorted) {
    for (const item of history.items) {
      if (item.field === 'status' && item.toString) {
        statusChanges.push({
          status: item.toString,
          date: history.created,
        });
      }
    }
  }

  if (statusChanges.length === 0) return [];

  const periods: StatusPeriod[] = [];
  const bhConfig = {
    startHour: options.businessHoursStart,
    endHour: options.businessHoursEnd,
    timezone: options.timezone,
  };

  for (let i = 0; i < statusChanges.length; i++) {
    const current = statusChanges[i]!;
    const next = statusChanges[i + 1];
    const startDate = current.date;
    const endDate = next ? next.date : null;

    let durationHours: number | null = null;
    if (endDate) {
      durationHours = options.businessDaysOnly
        ? calculateBusinessHours(new Date(startDate), new Date(endDate), bhConfig)
        : Math.round(
            ((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60)) * 10
          ) / 10;
    }

    periods.push({
      status: current.status,
      startDate,
      endDate,
      durationHours,
      isBusinessHours: options.businessDaysOnly,
    });
  }

  return periods;
}

function findFirstTransitionTo(
  histories: JiraChangelogHistory[],
  targetStatuses: string[]
): string | null {
  const lower = targetStatuses.map(s => s.toLowerCase());
  const sorted = [...histories].sort(
    (a, b) => new Date(a.created).getTime() - new Date(b.created).getTime()
  );

  for (const history of sorted) {
    for (const item of history.items) {
      if (item.field === 'status' && item.toString && lower.includes(item.toString.toLowerCase())) {
        return history.created;
      }
    }
  }

  return null;
}

function sumDurationsForStatuses(
  periods: StatusPeriod[],
  targetStatuses: string[],
  now: Date,
  options: LeadCycleTimeOptions
): number {
  let total = 0;
  const bhConfig = {
    startHour: options.businessHoursStart,
    endHour: options.businessHoursEnd,
    timezone: options.timezone,
  };

  for (const period of periods) {
    if (targetStatuses.some((s) => s.toLowerCase() === period.status.toLowerCase())) {
      if (period.durationHours !== null) {
        total += period.durationHours;
      } else if (period.endDate === null) {
        // Still in this status — calculate until now
        const hours = options.businessDaysOnly
          ? calculateBusinessHours(new Date(period.startDate), now, bhConfig)
          : Math.round(
              ((now.getTime() - new Date(period.startDate).getTime()) / (1000 * 60 * 60)) * 10
            ) / 10;
        total += hours;
      }
    }
  }

  return Math.round(total * 10) / 10;
}

function buildCodeReviewDetails(
  periods: StatusPeriod[],
  reviewStatuses: string[],
  changesRequestedStatuses: string[]
): CodeReviewDetail[] {
  const details: CodeReviewDetail[] = [];
  let round = 0;

  for (let i = 0; i < periods.length; i++) {
    const period = periods[i]!;
    if (reviewStatuses.some((s) => s.toLowerCase() === period.status.toLowerCase())) {
      round++;

      // Determine outcome based on the next status
      const nextPeriod = periods[i + 1];
      let outcome: CodeReviewDetail['outcome'] = 'in_progress';

      if (period.endDate !== null && nextPeriod) {
        if (changesRequestedStatuses.some((s) => s.toLowerCase() === nextPeriod.status.toLowerCase())) {
          outcome = 'changes_requested';
        } else {
          outcome = 'approved';
        }
      }

      details.push({
        reviewRound: round,
        startDate: period.startDate,
        endDate: period.endDate,
        durationHours: period.durationHours,
        outcome,
      });
    }
  }

  return details;
}

export async function calculateLeadCycleTime(
  jiraClient: JiraClient,
  issueKey: string,
  options: LeadCycleTimeOptions = DEFAULT_OPTIONS,
  cycleDevEndDateOverride?: string | null,
): Promise<Result<LeadCycleTimeResult>> {
  const issueResult = await jiraClient.getIssueWithChangelog(issueKey);
  if (!issueResult.success) return issueResult;

  const issue = issueResult.data;
  const histories = issue.changelog?.histories ?? [];
  const now = new Date();

  const timeline = buildStatusTimeline(histories, options);

  // Lead Time: first Ready → first Done
  // Fallback to issue creation date if no transition to a ready status found
  // (issues are often created directly in "À faire" without a changelog entry)
  const readyDate = findFirstTransitionTo(histories, options.readyStatuses)
    ?? issue.fields.created;
  const doneDate = findFirstTransitionTo(histories, options.doneStatuses);

  let leadTimeHours: number | null = null;
  let leadTimeBusinessDays: number | null = null;
  const isWIP = doneDate === null;

  const bhConfig = {
    startHour: options.businessHoursStart,
    endHour: options.businessHoursEnd,
    timezone: options.timezone,
  };

  if (readyDate) {
    const endPoint = doneDate ? new Date(doneDate) : now;
    leadTimeHours = options.businessDaysOnly
      ? calculateBusinessHours(new Date(readyDate), endPoint, bhConfig)
      : Math.round(
          ((endPoint.getTime() - new Date(readyDate).getTime()) / (1000 * 60 * 60)) * 10
        ) / 10;
    leadTimeBusinessDays = hoursToBusinessDays(leadTimeHours, bhConfig);
  }

  // Cycle Time: sum of in-progress + review periods (total active time)
  const activeStatuses = [...options.inProgressStatuses, ...options.reviewStatuses];
  const cycleTimeHours = sumDurationsForStatuses(timeline, activeStatuses, now, options);
  const activeTimeHours = cycleTimeHours;

  // Cycle Dev Time: first Ready/À faire → first "In Review" (or AI comment date if overridden)
  const allReviewStatuses = [...REVIEW_STATUSES.inReview, ...REVIEW_STATUSES.changesRequested];
  const readyForDevDate = findFirstTransitionTo(histories, options.readyStatuses)
    ?? issue.fields.created; // fallback: issue creation = entered backlog/à faire
  const inProgressDate = findFirstTransitionTo(histories, options.inProgressStatuses);
  const reviewDate = findFirstTransitionTo(histories, allReviewStatuses);

  // When cycleDevEndDateOverride is provided (AI agent mode), use it as end point
  const cycleDevEndDate = cycleDevEndDateOverride ?? reviewDate;

  let cycleDevTimeHours: number | null = null;
  if (readyForDevDate && cycleDevEndDate) {
    cycleDevTimeHours = options.businessDaysOnly
      ? calculateBusinessHours(new Date(readyForDevDate), new Date(cycleDevEndDate), bhConfig)
      : Math.round(
          ((new Date(cycleDevEndDate).getTime() - new Date(readyForDevDate).getTime()) / (1000 * 60 * 60)) * 10
        ) / 10;
  }

  // QW3: Decomposed Cycle Dev — Pickup Time (Ready → In Progress) and Dev Active Time (In Progress → In Review)
  let pickupTimeHours: number | null = null;
  if (readyForDevDate && inProgressDate) {
    pickupTimeHours = options.businessDaysOnly
      ? calculateBusinessHours(new Date(readyForDevDate), new Date(inProgressDate), bhConfig)
      : Math.round(
          ((new Date(inProgressDate).getTime() - new Date(readyForDevDate).getTime()) / (1000 * 60 * 60)) * 10
        ) / 10;
  }

  let devActiveTimeHours: number | null = null;
  const devActiveEnd = cycleDevEndDateOverride ?? reviewDate;
  if (inProgressDate && devActiveEnd) {
    devActiveTimeHours = options.businessDaysOnly
      ? calculateBusinessHours(new Date(inProgressDate), new Date(devActiveEnd), bhConfig)
      : Math.round(
          ((new Date(devActiveEnd).getTime() - new Date(inProgressDate).getTime()) / (1000 * 60 * 60)) * 10
        ) / 10;
  }

  // Code Review Time: only actual review statuses (not changesRequested/rework)
  const codeReviewTimeHours = sumDurationsForStatuses(
    timeline,
    REVIEW_STATUSES.inReview,
    now,
    options
  );

  // Wait Time: sum of blocked periods
  const waitTimeHours = sumDurationsForStatuses(timeline, options.blockedStatuses, now, options);

  // PR dates from review status periods
  const reviewPeriods = timeline.filter((p) =>
    options.reviewStatuses.some((s) => s.toLowerCase() === p.status.toLowerCase())
  );
  const prOpenDate = reviewPeriods.length > 0 ? reviewPeriods[0]!.startDate : null;
  const lastReviewPeriod = reviewPeriods.length > 0 ? reviewPeriods[reviewPeriods.length - 1]! : null;
  const prApprovedDate = lastReviewPeriod?.endDate ?? null;

  // Code review details
  const changesRequestedStatuses = REVIEW_STATUSES.changesRequested;
  const reviewInStatuses = REVIEW_STATUSES.inReview;
  const codeReviewDetails = buildCodeReviewDetails(timeline, reviewInStatuses, changesRequestedStatuses);

  return success({
    issueKey: issue.key,
    summary: issue.fields.summary,
    leadTimeHours,
    leadTimeBusinessDays,
    readyDate,
    doneDate,
    isWIP,
    cycleTimeHours: cycleTimeHours || null,
    cycleDevTimeHours,
    pickupTimeHours,
    devActiveTimeHours,
    inProgressDate,
    reviewDate,
    activeTimeHours: activeTimeHours || null,
    waitTimeHours: waitTimeHours || null,
    codeReviewTimeHours: codeReviewTimeHours || null,
    prOpenDate,
    prApprovedDate,
    codeReviewDetails,
    statusHistory: timeline,
    storyPoints: (issue.fields.story_points as number) ?? null,
  });
}

function buildTimeStats(values: (number | null)[]): TimeStats {
  const valid = values.filter((v): v is number => v !== null && v > 0);
  return {
    averageHours: average(valid),
    medianHours: median(valid),
    p85Hours: percentile(valid, 85),
    minHours: min(valid),
    maxHours: max(valid),
    sampleSize: valid.length,
  };
}

export async function calculateSprintLeadCycleTime(
  jiraClient: JiraClient,
  sprintId: number,
  options: LeadCycleTimeOptions = DEFAULT_OPTIONS
): Promise<Result<SprintLeadCycleTimeResult>> {
  const sprintResult = await jiraClient.getSprintUserStories(sprintId);
  if (!sprintResult.success) return sprintResult;

  const issues = sprintResult.data;
  const issueDetails: LeadCycleTimeResult[] = [];

  for (const issue of issues) {
    const result = await calculateLeadCycleTime(jiraClient, issue.key, options);
    if (result.success) {
      issueDetails.push(result.data);
    }
  }

  const wipCount = issueDetails.filter((d) => d.isWIP).length;

  return success({
    sprintId,
    sprintName: `Sprint ${sprintId}`,
    leadTime: buildTimeStats(issueDetails.map((d) => d.leadTimeHours)),
    cycleTime: buildTimeStats(issueDetails.map((d) => d.cycleTimeHours)),
    cycleDevTime: buildTimeStats(issueDetails.map((d) => d.cycleDevTimeHours)),
    pickupTime: buildTimeStats(issueDetails.map((d) => d.pickupTimeHours)),
    devActiveTime: buildTimeStats(issueDetails.map((d) => d.devActiveTimeHours)),
    codeReviewTime: buildTimeStats(issueDetails.map((d) => d.codeReviewTimeHours)),
    issueDetails,
    wipCount,
  });
}
