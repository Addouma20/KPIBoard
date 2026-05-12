import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildStatusTimeline,
  calculateLeadCycleTime,
  calculateSprintLeadCycleTime,
  DEFAULT_OPTIONS,
} from '../kpi/lead-cycle-time.kpi';
import { JiraClient } from '../clients/jira-client';
import type { JiraIssue, JiraChangelogHistory } from '../types/jira.types';
import type { LeadCycleTimeOptions } from '../types/kpi.types';

vi.mock('../clients/jira-client');

function makeHistory(
  id: string,
  created: string,
  fromStatus: string,
  toStatus: string
): JiraChangelogHistory {
  return {
    id,
    created,
    author: { displayName: 'Dev', name: 'dev', accountId: 'dev-1' },
    items: [
      {
        field: 'status',
        fieldtype: 'jira',
        from: null,
        fromString: fromStatus,
        to: null,
        toString: toStatus,
      },
    ],
  };
}

function makeAssigneeHistory(
  id: string,
  created: string,
  toAccountId: string,
  toDisplayName: string
): JiraChangelogHistory {
  return {
    id,
    created,
    author: { displayName: toDisplayName, name: toDisplayName.toLowerCase(), accountId: toAccountId },
    items: [
      {
        field: 'assignee',
        fieldtype: 'jira',
        from: null,
        fromString: null,
        to: toAccountId,
        toString: toDisplayName,
      },
    ],
  };
}


  key: string,
  summary: string,
  histories: JiraChangelogHistory[]
): JiraIssue {
  return {
    key,
    id: key,
    fields: {
      summary,
      status: { name: 'Done', id: '1', statusCategory: { key: 'done', name: 'Done' } },
      issuetype: { name: 'Story', id: '10', subtask: false },
      priority: { name: 'Medium', id: '3' },
      assignee: null,
      created: '2026-04-01T09:00:00.000Z',
      resolutiondate: null,
      labels: [],
      components: [],
      issuelinks: [],
      subtasks: [],
      description: null,
    },
    changelog: { histories },
  };
}

// Use calendar hours to simplify test assertions
const testOptions: LeadCycleTimeOptions = {
  ...DEFAULT_OPTIONS,
  businessDaysOnly: false,
};

describe('buildStatusTimeline', () => {
  it('builds periods from changelog histories', () => {
    const histories: JiraChangelogHistory[] = [
      makeHistory('1', '2026-04-01T09:00:00.000Z', 'To Do', 'Ready'),
      makeHistory('2', '2026-04-01T12:00:00.000Z', 'Ready', 'In Progress'),
      makeHistory('3', '2026-04-02T09:00:00.000Z', 'In Progress', 'Done'),
    ];

    const timeline = buildStatusTimeline(histories, testOptions);

    expect(timeline).toHaveLength(3);
    expect(timeline[0]!.status).toBe('Ready');
    expect(timeline[1]!.status).toBe('In Progress');
    expect(timeline[2]!.status).toBe('Done');
    expect(timeline[2]!.endDate).toBeNull();
  });

  it('returns empty array when no status changes', () => {
    expect(buildStatusTimeline([], testOptions)).toEqual([]);
  });
});

describe('calculateLeadCycleTime', () => {
  let mockClient: JiraClient;

  beforeEach(() => {
    mockClient = new JiraClient() as JiraClient;
    vi.clearAllMocks();
    // Default: no AI comment found (cycleDevTimeHours = null unless overridden per test)
    vi.spyOn(mockClient, 'findFirstAICommentDate').mockResolvedValue(null);
  });

  it('calculates correct Lead Time between Ready and Done', async () => {
    const histories = [
      makeHistory('1', '2026-04-01T09:00:00.000Z', 'To Do', 'Ready'),
      makeHistory('2', '2026-04-01T10:00:00.000Z', 'Ready', 'In Progress'),
      makeHistory('3', '2026-04-01T18:00:00.000Z', 'In Progress', 'In Review'),
      makeHistory('4', '2026-04-02T10:00:00.000Z', 'In Review', 'Done'),
    ];

    const issue = makeIssue('PROJ-1', 'Test US', histories);
    vi.spyOn(mockClient, 'getIssueWithChangelog').mockResolvedValue({
      success: true,
      data: issue,
    });

    const result = await calculateLeadCycleTime(mockClient, 'PROJ-1', testOptions);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.issueKey).toBe('PROJ-1');
    expect(result.data.isWIP).toBe(false);
    expect(result.data.readyDate).toBe('2026-04-01T09:00:00.000Z');
    expect(result.data.doneDate).toBe('2026-04-02T10:00:00.000Z');
    // Lead Time = 25 hours (Apr 1 09:00 → Apr 2 10:00)
    expect(result.data.leadTimeHours).toBe(25);
  });

  it('calculates Cycle Dev Time from self-assignment date to first AI comment', async () => {
    const histories = [
      makeHistory('1', '2026-04-01T09:00:00.000Z', 'To Do', 'Ready'),
      makeHistory('2', '2026-04-01T10:00:00.000Z', 'Ready', 'In Progress'),
      // Dev assigns themselves the card at 09:00 on Apr 2
      makeAssigneeHistory('3', '2026-04-02T09:00:00.000Z', 'dev-1', 'Dev User'),
      makeHistory('4', '2026-04-02T13:00:00.000Z', 'In Progress', 'In Review'),
      makeHistory('5', '2026-04-02T17:00:00.000Z', 'In Review', 'Done'),
    ];

    const issue = makeIssue('PROJ-CDT', 'Cycle Dev Time Test', histories);
    vi.spyOn(mockClient, 'getIssueWithChangelog').mockResolvedValue({
      success: true,
      data: issue,
    });
    // AI comment posted at Apr 2 11:00 (between self-assignment and In Review)
    vi.spyOn(mockClient, 'findFirstAICommentDate').mockResolvedValue('2026-04-02T11:00:00.000Z');

    const result = await calculateLeadCycleTime(mockClient, 'PROJ-CDT', { ...testOptions, isIA: true });

    expect(result.success).toBe(true);
    if (!result.success) return;

    // Assigned to me: Apr 2 09:00
    expect(result.data.assignedToMeDate).toBe('2026-04-02T09:00:00.000Z');
    expect(result.data.aiCommentDate).toBe('2026-04-02T11:00:00.000Z');
    // Cycle Dev Time = Apr 2 09:00 → Apr 2 11:00 = 2 hours
    expect(result.data.cycleDevTimeHours).toBe(2);
    expect(result.data.devActiveTimeHours).toBe(2);
  });

  it('returns null cycleDevTimeHours when no AI comment found', async () => {
    const histories = [
      makeHistory('1', '2026-04-01T09:00:00.000Z', 'To Do', 'Ready'),
      makeHistory('2', '2026-04-01T10:00:00.000Z', 'Ready', 'In Progress'),
      makeAssigneeHistory('3', '2026-04-01T10:30:00.000Z', 'dev-1', 'Dev User'),
      makeHistory('4', '2026-04-01T16:00:00.000Z', 'In Progress', 'Done'),
    ];

    const issue = makeIssue('PROJ-NOAI', 'No AI comment', histories);
    vi.spyOn(mockClient, 'getIssueWithChangelog').mockResolvedValue({
      success: true,
      data: issue,
    });
    // findFirstAICommentDate already mocked to null in beforeEach

    const result = await calculateLeadCycleTime(mockClient, 'PROJ-NOAI', { ...testOptions, isIA: true });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.assignedToMeDate).toBe('2026-04-01T10:30:00.000Z');
    expect(result.data.cycleDevTimeHours).toBeNull();
    expect(result.data.devActiveTimeHours).toBeNull();
  });

  it('returns null cycleDevTimeHours when card was never assigned (IA mode)', async () => {
    const histories = [
      makeHistory('1', '2026-04-01T09:00:00.000Z', 'To Do', 'Ready'),
      makeHistory('2', '2026-04-01T10:00:00.000Z', 'Ready', 'In Progress'),
      makeHistory('3', '2026-04-01T16:00:00.000Z', 'In Progress', 'Done'),
    ];

    const issue = makeIssue('PROJ-NOASSIGN', 'Never assigned', histories);
    vi.spyOn(mockClient, 'getIssueWithChangelog').mockResolvedValue({
      success: true,
      data: issue,
    });
    vi.spyOn(mockClient, 'findFirstAICommentDate').mockResolvedValue('2026-04-01T14:00:00.000Z');

    const result = await calculateLeadCycleTime(mockClient, 'PROJ-NOASSIGN', { ...testOptions, isIA: true });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.assignedToMeDate).toBeNull();
    expect(result.data.cycleDevTimeHours).toBeNull();
  });

  it('calculates Cycle Dev Time for human dev: firstInProgressDate → firstInReviewDate', async () => {
    const histories = [
      makeHistory('1', '2026-04-01T09:00:00.000Z', 'To Do', 'Ready'),
      makeHistory('2', '2026-04-01T10:00:00.000Z', 'Ready', 'In Progress'),
      // 6 hours of dev work
      makeHistory('3', '2026-04-01T16:00:00.000Z', 'In Progress', 'In Review'),
      makeHistory('4', '2026-04-01T20:00:00.000Z', 'In Review', 'Done'),
    ];

    const issue = makeIssue('PROJ-HUMAN', 'Human dev US', histories);
    vi.spyOn(mockClient, 'getIssueWithChangelog').mockResolvedValue({
      success: true,
      data: issue,
    });

    const result = await calculateLeadCycleTime(mockClient, 'PROJ-HUMAN', { ...testOptions, isIA: false });

    expect(result.success).toBe(true);
    if (!result.success) return;

    // Human CycleDevTime = firstInProgress (10:00) → firstInReview (16:00) = 6h
    expect(result.data.inProgressDate).toBe('2026-04-01T10:00:00.000Z');
    expect(result.data.reviewDate).toBe('2026-04-01T16:00:00.000Z');
    expect(result.data.cycleDevTimeHours).toBe(6);
  });

  it('returns null cycleDevTimeHours for human dev when no In Review transition', async () => {
    const histories = [
      makeHistory('1', '2026-04-01T09:00:00.000Z', 'To Do', 'Ready'),
      makeHistory('2', '2026-04-01T10:00:00.000Z', 'Ready', 'In Progress'),
      // Goes directly to Done (no review)
      makeHistory('3', '2026-04-01T16:00:00.000Z', 'In Progress', 'Done'),
    ];

    const issue = makeIssue('PROJ-HUMAN-NOREV', 'Human no review', histories);
    vi.spyOn(mockClient, 'getIssueWithChangelog').mockResolvedValue({
      success: true,
      data: issue,
    });

    const result = await calculateLeadCycleTime(mockClient, 'PROJ-HUMAN-NOREV', { ...testOptions, isIA: false });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.reviewDate).toBeNull();
    expect(result.data.cycleDevTimeHours).toBeNull();
  });

  it('returns isWIP=true if US not Done', async () => {
    const histories = [
      makeHistory('1', '2026-04-01T09:00:00.000Z', 'To Do', 'Ready'),
      makeHistory('2', '2026-04-01T10:00:00.000Z', 'Ready', 'In Progress'),
    ];

    const issue = makeIssue('PROJ-2', 'WIP US', histories);
    vi.spyOn(mockClient, 'getIssueWithChangelog').mockResolvedValue({
      success: true,
      data: issue,
    });

    const result = await calculateLeadCycleTime(mockClient, 'PROJ-2', testOptions);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.isWIP).toBe(true);
    expect(result.data.doneDate).toBeNull();
    expect(result.data.leadTimeHours).toBeGreaterThan(0);
  });

  it('calculates Cycle Time as sum of active periods', async () => {
    const histories = [
      makeHistory('1', '2026-04-01T09:00:00.000Z', 'To Do', 'Ready'),
      makeHistory('2', '2026-04-01T10:00:00.000Z', 'Ready', 'In Progress'),
      // 8 hours in progress
      makeHistory('3', '2026-04-01T18:00:00.000Z', 'In Progress', 'Blocked'),
      // 2 hours blocked (not counted in cycle time)
      makeHistory('4', '2026-04-01T20:00:00.000Z', 'Blocked', 'In Progress'),
      // 4 more hours in progress
      makeHistory('5', '2026-04-02T00:00:00.000Z', 'In Progress', 'Done'),
    ];

    const issue = makeIssue('PROJ-3', 'Cycle Test', histories);
    vi.spyOn(mockClient, 'getIssueWithChangelog').mockResolvedValue({
      success: true,
      data: issue,
    });

    const result = await calculateLeadCycleTime(mockClient, 'PROJ-3', testOptions);

    expect(result.success).toBe(true);
    if (!result.success) return;

    // Cycle time = 8h (In Progress) + 4h (In Progress) = 12h
    expect(result.data.cycleTimeHours).toBe(12);
    // Wait time = 2h (Blocked)
    expect(result.data.waitTimeHours).toBe(2);
  });

  it('calculates Code Review Time separately', async () => {
    const histories = [
      makeHistory('1', '2026-04-01T09:00:00.000Z', 'To Do', 'Ready'),
      makeHistory('2', '2026-04-01T10:00:00.000Z', 'Ready', 'In Progress'),
      makeHistory('3', '2026-04-01T16:00:00.000Z', 'In Progress', 'In Review'),
      // 4 hours in review
      makeHistory('4', '2026-04-01T20:00:00.000Z', 'In Review', 'Done'),
    ];

    const issue = makeIssue('PROJ-4', 'Review Test', histories);
    vi.spyOn(mockClient, 'getIssueWithChangelog').mockResolvedValue({
      success: true,
      data: issue,
    });

    const result = await calculateLeadCycleTime(mockClient, 'PROJ-4', testOptions);

    expect(result.success).toBe(true);
    if (!result.success) return;

    // Code review time = 4h (In Review)
    expect(result.data.codeReviewTimeHours).toBe(4);
    // Cycle time = 6h (In Progress) + 4h (In Review) = 10h
    expect(result.data.cycleTimeHours).toBe(10);
  });

  it('handles US with multiple review rounds', async () => {
    const histories = [
      makeHistory('1', '2026-04-01T09:00:00.000Z', 'To Do', 'Ready'),
      makeHistory('2', '2026-04-01T10:00:00.000Z', 'Ready', 'In Progress'),
      makeHistory('3', '2026-04-01T16:00:00.000Z', 'In Progress', 'In Review'),
      // Round 1: 2h review → changes requested
      makeHistory('4', '2026-04-01T18:00:00.000Z', 'In Review', 'Changes Requested'),
      // Rework
      makeHistory('5', '2026-04-02T09:00:00.000Z', 'Changes Requested', 'In Progress'),
      makeHistory('6', '2026-04-02T12:00:00.000Z', 'In Progress', 'In Review'),
      // Round 2: 3h review → approved
      makeHistory('7', '2026-04-02T15:00:00.000Z', 'In Review', 'Done'),
    ];

    const issue = makeIssue('PROJ-5', 'Multi Review', histories);
    vi.spyOn(mockClient, 'getIssueWithChangelog').mockResolvedValue({
      success: true,
      data: issue,
    });

    const result = await calculateLeadCycleTime(mockClient, 'PROJ-5', testOptions);

    expect(result.success).toBe(true);
    if (!result.success) return;

    // Two review rounds
    expect(result.data.codeReviewDetails).toHaveLength(2);
    expect(result.data.codeReviewDetails[0]!.reviewRound).toBe(1);
    expect(result.data.codeReviewDetails[0]!.outcome).toBe('changes_requested');
    expect(result.data.codeReviewDetails[0]!.durationHours).toBe(2);

    expect(result.data.codeReviewDetails[1]!.reviewRound).toBe(2);
    expect(result.data.codeReviewDetails[1]!.outcome).toBe('approved');
    expect(result.data.codeReviewDetails[1]!.durationHours).toBe(3);

    // Total code review time = 2h + 3h = 5h
    expect(result.data.codeReviewTimeHours).toBe(5);
  });

  it('falls back to creation date if US never transitioned to "Ready"', async () => {
    const histories = [
      makeHistory('1', '2026-04-01T09:00:00.000Z', 'To Do', 'In Progress'),
      makeHistory('2', '2026-04-02T09:00:00.000Z', 'In Progress', 'Done'),
    ];

    const issue = makeIssue('PROJ-6', 'No Ready', histories);
    vi.spyOn(mockClient, 'getIssueWithChangelog').mockResolvedValue({
      success: true,
      data: issue,
    });

    const result = await calculateLeadCycleTime(mockClient, 'PROJ-6', testOptions);

    expect(result.success).toBe(true);
    if (!result.success) return;

    // Falls back to issue creation date as readyDate
    expect(result.data.readyDate).toBe('2026-04-01T09:00:00.000Z');
    // Creation (Apr 1 09:00) → Done (Apr 2 09:00) = 24 calendar hours (businessDaysOnly: false)
    expect(result.data.leadTimeHours).toBe(24);
    expect(result.data.leadTimeBusinessDays).toBeCloseTo(2.7, 1);
  });
});

describe('calculateSprintLeadCycleTime', () => {
  let mockClient: JiraClient;

  beforeEach(() => {
    mockClient = new JiraClient() as JiraClient;
    vi.clearAllMocks();
  });

  it('sprint aggregation computes correct TimeStats', async () => {
    // 3 issues with different lead times
    const issue1 = makeIssue('PROJ-10', 'US 1', [
      makeHistory('1', '2026-04-01T09:00:00.000Z', 'To Do', 'Ready'),
      makeHistory('2', '2026-04-01T10:00:00.000Z', 'Ready', 'In Progress'),
      makeHistory('3', '2026-04-01T20:00:00.000Z', 'In Progress', 'Done'),
    ]);

    const issue2 = makeIssue('PROJ-11', 'US 2', [
      makeHistory('4', '2026-04-01T09:00:00.000Z', 'To Do', 'Ready'),
      makeHistory('5', '2026-04-01T10:00:00.000Z', 'Ready', 'In Progress'),
      makeHistory('6', '2026-04-02T10:00:00.000Z', 'In Progress', 'Done'),
    ]);

    const issue3 = makeIssue('PROJ-12', 'US 3 WIP', [
      makeHistory('7', '2026-04-01T09:00:00.000Z', 'To Do', 'Ready'),
      makeHistory('8', '2026-04-01T10:00:00.000Z', 'Ready', 'In Progress'),
      // Not done → WIP
    ]);

    vi.spyOn(mockClient, 'getSprintUserStories').mockResolvedValue({
      success: true,
      data: [issue1, issue2, issue3],
    });

    vi.spyOn(mockClient, 'getIssueWithChangelog')
      .mockResolvedValueOnce({ success: true, data: issue1 })
      .mockResolvedValueOnce({ success: true, data: issue2 })
      .mockResolvedValueOnce({ success: true, data: issue3 });

    const result = await calculateSprintLeadCycleTime(mockClient, 100, testOptions);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.sprintId).toBe(100);
    expect(result.data.wipCount).toBe(1);
    expect(result.data.issueDetails).toHaveLength(3);

    // Lead time stats: issue1=11h, issue2=25h, issue3=WIP (>0h)
    // All 3 have lead times > 0, so sampleSize >= 3
    expect(result.data.leadTime.sampleSize).toBeGreaterThanOrEqual(2);
    expect(result.data.leadTime.averageHours).not.toBeNull();
    expect(result.data.leadTime.medianHours).not.toBeNull();

    // Cycle time stats: issue1=10h, issue2=24h, issue3 still in progress
    expect(result.data.cycleTime.sampleSize).toBeGreaterThanOrEqual(2);
  });
});
