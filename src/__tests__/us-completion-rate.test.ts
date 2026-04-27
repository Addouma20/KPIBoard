import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateUSCompletionRate, getSprintHistory } from '../kpi/us-completion-rate.kpi';
import type { JiraIssue, JiraSprint, JiraChangelog } from '../types/jira.types';
import type { Result } from '../types/result.types';

// --- Helpers ---

function makeIssue(key: string, statusName: string): JiraIssue {
  return {
    key,
    id: key,
    fields: {
      summary: `Summary ${key}`,
      status: { name: statusName, id: '1', statusCategory: { key: 'done', name: 'Done' } },
      issuetype: { name: 'Story', id: '10001', subtask: false },
      priority: { name: 'Medium', id: '3' },
      assignee: null,
      created: '2026-01-01T10:00:00.000Z',
      resolutiondate: null,
      labels: [],
      components: [],
      issuelinks: [],
      subtasks: [],
      description: null,
    },
  };
}

function makeChangelog(
  transitionAuthor: string,
  toStatus = 'Done',
): JiraChangelog {
  return {
    histories: [
      {
        id: '1',
        created: '2026-01-05T10:00:00.000Z',
        author: { displayName: transitionAuthor, name: transitionAuthor },
        items: [
          {
            field: 'status',
            fieldtype: 'jira',
            from: '3',
            fromString: 'In Progress',
            to: '10',
            toString: toStatus,
          },
        ],
      },
    ],
  };
}

function makeIssueWithChangelog(
  key: string,
  statusName: string,
  transitionAuthor: string,
): JiraIssue {
  return {
    ...makeIssue(key, statusName),
    changelog: makeChangelog(transitionAuthor, statusName),
  };
}

function makeSprint(id: number, name: string, endDate: string): JiraSprint {
  return {
    id,
    name,
    state: 'closed',
    startDate: '2026-01-01T00:00:00.000Z',
    endDate,
  };
}

type MockJiraClient = {
  getSprintUserStories: ReturnType<typeof vi.fn>;
  getIssueWithChangelog: ReturnType<typeof vi.fn>;
  getSprints: ReturnType<typeof vi.fn>;
};

function createMockClient(): MockJiraClient {
  return {
    getSprintUserStories: vi.fn(),
    getIssueWithChangelog: vi.fn(),
    getSprints: vi.fn(),
  };
}

const SERVICE_ACCOUNT = 'jira-workflow-bot';

// --- Tests ---

describe('calculateUSCompletionRate', () => {
  let client: MockJiraClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('returns 0% completion if no US is Done', async () => {
    client.getSprintUserStories.mockResolvedValue({
      success: true,
      data: [
        makeIssue('US-1', 'In Progress'),
        makeIssue('US-2', 'To Do'),
        makeIssue('US-3', 'In Review'),
      ],
    } satisfies Result<JiraIssue[]>);

    const result = await calculateUSCompletionRate(client as never, 100, SERVICE_ACCOUNT);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.completionRatePercent).toBe(0);
    expect(result.data.doneByWorkflow).toBe(0);
    expect(result.data.doneManually).toBe(0);
    expect(result.data.remaining).toBe(3);
    expect(result.data.totalUS).toBe(3);
  });

  it('returns 100% if all US Done by workflow', async () => {
    client.getSprintUserStories.mockResolvedValue({
      success: true,
      data: [
        makeIssue('US-1', 'Done'),
        makeIssue('US-2', 'Done'),
      ],
    });

    client.getIssueWithChangelog
      .mockResolvedValueOnce({ success: true, data: makeIssueWithChangelog('US-1', 'Done', SERVICE_ACCOUNT) })
      .mockResolvedValueOnce({ success: true, data: makeIssueWithChangelog('US-2', 'Done', SERVICE_ACCOUNT) });

    const result = await calculateUSCompletionRate(client as never, 100, SERVICE_ACCOUNT);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.completionRatePercent).toBe(100);
    expect(result.data.workflowRatePercent).toBe(100);
    expect(result.data.doneByWorkflow).toBe(2);
    expect(result.data.doneManually).toBe(0);
    expect(result.data.remaining).toBe(0);
  });

  it('correctly distinguishes Done-workflow vs Done-manually', async () => {
    client.getSprintUserStories.mockResolvedValue({
      success: true,
      data: [
        makeIssue('US-1', 'Done'),
        makeIssue('US-2', 'Done'),
        makeIssue('US-3', 'In Progress'),
      ],
    });

    client.getIssueWithChangelog
      .mockResolvedValueOnce({ success: true, data: makeIssueWithChangelog('US-1', 'Done', SERVICE_ACCOUNT) })
      .mockResolvedValueOnce({ success: true, data: makeIssueWithChangelog('US-2', 'Done', 'human-user') });

    const result = await calculateUSCompletionRate(client as never, 100, SERVICE_ACCOUNT);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.doneByWorkflow).toBe(1);
    expect(result.data.doneManually).toBe(1);
    expect(result.data.remaining).toBe(1);
    expect(result.data.completionRatePercent).toBeCloseTo(66.7, 1);
    expect(result.data.workflowRatePercent).toBe(50);
  });

  it('returns 0 rates if totalUS === 0', async () => {
    client.getSprintUserStories.mockResolvedValue({
      success: true,
      data: [],
    });

    const result = await calculateUSCompletionRate(client as never, 100, SERVICE_ACCOUNT);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.totalUS).toBe(0);
    expect(result.data.completionRatePercent).toBe(0);
    expect(result.data.workflowRatePercent).toBe(0);
  });

  it('rounds percentage to 1 decimal', async () => {
    // 1 done out of 3 → 33.333...% → 33.3
    client.getSprintUserStories.mockResolvedValue({
      success: true,
      data: [
        makeIssue('US-1', 'Done'),
        makeIssue('US-2', 'To Do'),
        makeIssue('US-3', 'To Do'),
      ],
    });

    client.getIssueWithChangelog.mockResolvedValueOnce({
      success: true,
      data: makeIssueWithChangelog('US-1', 'Done', SERVICE_ACCOUNT),
    });

    const result = await calculateUSCompletionRate(client as never, 100, SERVICE_ACCOUNT);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.completionRatePercent).toBe(33.3);
  });

  it('propagates Jira errors from getSprintUserStories', async () => {
    client.getSprintUserStories.mockResolvedValue({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid token' },
    });

    const result = await calculateUSCompletionRate(client as never, 100, SERVICE_ACCOUNT);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('UNAUTHORIZED');
  });

  it('propagates Jira errors from getIssueWithChangelog', async () => {
    client.getSprintUserStories.mockResolvedValue({
      success: true,
      data: [makeIssue('US-1', 'Done')],
    });

    client.getIssueWithChangelog.mockResolvedValueOnce({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Issue not found' },
    });

    const result = await calculateUSCompletionRate(client as never, 100, SERVICE_ACCOUNT);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('NOT_FOUND');
  });
});

describe('getSprintHistory', () => {
  let client: MockJiraClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('returns sorted by endDate ascending', async () => {
    client.getSprints.mockResolvedValue({
      success: true,
      data: [
        makeSprint(3, 'Sprint 3', '2026-03-15T00:00:00.000Z'),
        makeSprint(1, 'Sprint 1', '2026-01-15T00:00:00.000Z'),
        makeSprint(2, 'Sprint 2', '2026-02-15T00:00:00.000Z'),
      ],
    });

    // Each sprint has 1 Done US by workflow
    client.getSprintUserStories.mockResolvedValue({
      success: true,
      data: [makeIssue('US-1', 'Done')],
    });
    client.getIssueWithChangelog.mockResolvedValue({
      success: true,
      data: makeIssueWithChangelog('US-1', 'Done', SERVICE_ACCOUNT),
    });

    const result = await getSprintHistory(client as never, 42, 5, SERVICE_ACCOUNT);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(3);
    expect(result.data[0].sprintName).toBe('Sprint 1');
    expect(result.data[1].sprintName).toBe('Sprint 2');
    expect(result.data[2].sprintName).toBe('Sprint 3');
  });

  it('handles sprints with 0 US (null rates)', async () => {
    client.getSprints.mockResolvedValue({
      success: true,
      data: [makeSprint(1, 'Empty Sprint', '2026-01-15T00:00:00.000Z')],
    });

    client.getSprintUserStories.mockResolvedValue({
      success: true,
      data: [],
    });

    const result = await getSprintHistory(client as never, 42, 5, SERVICE_ACCOUNT);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0].completionRatePercent).toBeNull();
    expect(result.data[0].workflowRatePercent).toBeNull();
    expect(result.data[0].totalUS).toBe(0);
    expect(result.data[0].doneUS).toBe(0);
  });

  it('takes only the last N sprints', async () => {
    client.getSprints.mockResolvedValue({
      success: true,
      data: [
        makeSprint(1, 'Sprint 1', '2026-01-15T00:00:00.000Z'),
        makeSprint(2, 'Sprint 2', '2026-02-15T00:00:00.000Z'),
        makeSprint(3, 'Sprint 3', '2026-03-15T00:00:00.000Z'),
        makeSprint(4, 'Sprint 4', '2026-04-15T00:00:00.000Z'),
      ],
    });

    client.getSprintUserStories.mockResolvedValue({
      success: true,
      data: [makeIssue('US-1', 'Done')],
    });
    client.getIssueWithChangelog.mockResolvedValue({
      success: true,
      data: makeIssueWithChangelog('US-1', 'Done', SERVICE_ACCOUNT),
    });

    const result = await getSprintHistory(client as never, 42, 2, SERVICE_ACCOUNT);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(2);
    expect(result.data[0].sprintName).toBe('Sprint 3');
    expect(result.data[1].sprintName).toBe('Sprint 4');
  });

  it('propagates Jira errors from getSprints', async () => {
    client.getSprints.mockResolvedValue({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Jira down' },
    });

    const result = await getSprintHistory(client as never, 42);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('SERVER_ERROR');
  });
});
