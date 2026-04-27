import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateMRIterations, calculateSprintMRIterations } from '../kpi/mr-iterations.kpi';
import type { JiraIssue, JiraChangelogHistory, JiraSprint } from '../types';
import type { MRIterationsResult } from '../types';
import { JiraClient } from '../clients/jira-client';

// --- Helpers to build test data ---

function makeUser(name = 'reviewer') {
  return { displayName: name, name, emailAddress: `${name}@test.com` };
}

function makeStatusTransition(
  from: string,
  to: string,
  date: string,
  author = 'reviewer',
): JiraChangelogHistory {
  return {
    id: String(Math.random()),
    created: date,
    author: makeUser(author),
    items: [
      {
        field: 'status',
        fieldtype: 'jira',
        from: null,
        fromString: from,
        to: null,
        toString: to,
      },
    ],
  };
}

function makeIssue(
  key: string,
  histories: JiraChangelogHistory[] = [],
  customFields: Record<string, unknown> = {},
): JiraIssue {
  return {
    key,
    id: key,
    fields: {
      summary: `Summary of ${key}`,
      status: { name: 'Done', id: '1', statusCategory: { key: 'done', name: 'Done' } },
      issuetype: { name: 'Story', id: '10001', subtask: false },
      priority: { name: 'Medium', id: '3' },
      assignee: null,
      created: '2026-04-01T09:00:00Z',
      resolutiondate: '2026-04-10T17:00:00Z',
      labels: [],
      components: [],
      issuelinks: [],
      subtasks: [],
      description: null,
      ...customFields,
    },
    changelog: { histories },
  };
}

// --- Mock JiraClient ---

function createMockClient(overrides: Partial<Record<keyof JiraClient, unknown>> = {}) {
  return {
    getIssueWithChangelog: vi.fn(),
    getConfig: vi.fn().mockReturnValue({
      baseUrl: 'https://jira.test.com',
      email: 'test@test.com',
      token: 'token',
      projectKey: 'PROJ',
      cacheTtlSeconds: 300,
      workflowServiceAccount: 'workflow-bot',
      iterationsCustomField: 'customfield_10020',
    }),
    getSprints: vi.fn().mockResolvedValue({
      success: true,
      data: [{ id: 100, name: 'Sprint 1', state: 'closed', startDate: '', endDate: '' }],
    }),
    getSprintUserStories: vi.fn(),
    ...overrides,
  } as unknown as JiraClient;
}

// --- Tests ---

describe('calculateMRIterations', () => {
  it('returns 1 iteration when MR accepted without back-and-forth', async () => {
    const issue = makeIssue('PROJ-1', [
      makeStatusTransition('In Progress', 'In Review', '2026-04-05T10:00:00Z', 'dev'),
      makeStatusTransition('In Review', 'Done', '2026-04-06T14:00:00Z', 'reviewer'),
    ]);

    const client = createMockClient({
      getIssueWithChangelog: vi.fn().mockResolvedValue({ success: true, data: issue }),
    });

    const result = await calculateMRIterations(client, 'PROJ-1');
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.iterationsCount).toBe(1);
    expect(result.data.dataSource).toBe('status_transitions');
    expect(result.data.reviewTransitions).toHaveLength(0);
  });

  it('counts correct iterations from multiple review cycles', async () => {
    const issue = makeIssue('PROJ-2', [
      makeStatusTransition('In Progress', 'In Review', '2026-04-05T10:00:00Z', 'dev'),
      makeStatusTransition('In Review', 'Changes Requested', '2026-04-05T14:00:00Z', 'reviewer'),
      makeStatusTransition('Changes Requested', 'In Progress', '2026-04-06T09:00:00Z', 'dev'),
      makeStatusTransition('In Progress', 'In Review', '2026-04-06T15:00:00Z', 'dev'),
      makeStatusTransition('In Review', 'Changes Requested', '2026-04-07T10:00:00Z', 'reviewer'),
      makeStatusTransition('Changes Requested', 'In Progress', '2026-04-07T14:00:00Z', 'dev'),
      makeStatusTransition('In Progress', 'In Review', '2026-04-08T09:00:00Z', 'dev'),
      makeStatusTransition('In Review', 'Done', '2026-04-08T16:00:00Z', 'reviewer'),
    ]);

    const client = createMockClient({
      getIssueWithChangelog: vi.fn().mockResolvedValue({ success: true, data: issue }),
    });

    const result = await calculateMRIterations(client, 'PROJ-2');
    expect(result.success).toBe(true);
    if (!result.success) return;

    // 2 rework transitions → iterationsCount = 3
    expect(result.data.iterationsCount).toBe(3);
    expect(result.data.dataSource).toBe('status_transitions');
    expect(result.data.reviewTransitions).toHaveLength(2);
    expect(result.data.reviewTransitions[0]!.to).toBe('changes requested');
    expect(result.data.reviewTransitions[1]!.to).toBe('changes requested');
  });

  it('tries custom field first, falls back to transitions', async () => {
    const issueWithField = makeIssue(
      'PROJ-3',
      [
        makeStatusTransition('In Progress', 'In Review', '2026-04-05T10:00:00Z'),
        makeStatusTransition('In Review', 'Changes Requested', '2026-04-06T10:00:00Z'),
      ],
      { customfield_10020: 2 },
    );

    const client = createMockClient({
      getIssueWithChangelog: vi.fn().mockResolvedValue({ success: true, data: issueWithField }),
    });

    const result = await calculateMRIterations(client, 'PROJ-3');
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.iterationsCount).toBe(2);
    expect(result.data.dataSource).toBe('custom_field');
    expect(result.data.reviewTransitions).toHaveLength(0);
  });

  it('falls back to transitions when custom field is null', async () => {
    const issue = makeIssue(
      'PROJ-4',
      [
        makeStatusTransition('In Progress', 'In Review', '2026-04-05T10:00:00Z'),
        makeStatusTransition('In Review', 'In Progress', '2026-04-06T10:00:00Z', 'reviewer'),
        makeStatusTransition('In Progress', 'In Review', '2026-04-07T10:00:00Z'),
        makeStatusTransition('In Review', 'Done', '2026-04-08T10:00:00Z'),
      ],
      { customfield_10020: null },
    );

    const client = createMockClient({
      getIssueWithChangelog: vi.fn().mockResolvedValue({ success: true, data: issue }),
    });

    const result = await calculateMRIterations(client, 'PROJ-4');
    expect(result.success).toBe(true);
    if (!result.success) return;

    // 1 rework (In Review → In Progress) → iterationsCount = 2
    expect(result.data.iterationsCount).toBe(2);
    expect(result.data.dataSource).toBe('status_transitions');
    expect(result.data.reviewTransitions).toHaveLength(1);
    expect(result.data.reviewTransitions[0]!.to).toBe('in progress');
  });

  it('returns null/unavailable if no review data in changelog', async () => {
    const issue = makeIssue('PROJ-5', [
      makeStatusTransition('To Do', 'In Progress', '2026-04-05T10:00:00Z'),
      makeStatusTransition('In Progress', 'Done', '2026-04-08T17:00:00Z'),
    ]);

    const client = createMockClient({
      getIssueWithChangelog: vi.fn().mockResolvedValue({ success: true, data: issue }),
    });

    const result = await calculateMRIterations(client, 'PROJ-5');
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.iterationsCount).toBeNull();
    expect(result.data.dataSource).toBe('unavailable');
  });

  it('propagates Jira client errors', async () => {
    const client = createMockClient({
      getIssueWithChangelog: vi.fn().mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Issue not found', statusCode: 404 },
      }),
    });

    const result = await calculateMRIterations(client, 'PROJ-999');
    expect(result.success).toBe(false);
  });
});

describe('calculateSprintMRIterations', () => {
  it('computes correct average, median, max and distribution', async () => {
    // 4 stories with iterationsCount: 1, 2, 3, null
    const stories = [
      makeIssue('PROJ-10'),
      makeIssue('PROJ-11'),
      makeIssue('PROJ-12'),
      makeIssue('PROJ-13'),
    ];

    const iterationsResults: Record<string, JiraIssue> = {
      'PROJ-10': makeIssue('PROJ-10', [
        makeStatusTransition('In Progress', 'In Review', '2026-04-05T10:00:00Z'),
        makeStatusTransition('In Review', 'Done', '2026-04-06T10:00:00Z'),
      ]),
      'PROJ-11': makeIssue('PROJ-11', [
        makeStatusTransition('In Progress', 'In Review', '2026-04-05T10:00:00Z'),
        makeStatusTransition('In Review', 'Changes Requested', '2026-04-06T10:00:00Z'),
        makeStatusTransition('Changes Requested', 'In Review', '2026-04-07T10:00:00Z'),
        makeStatusTransition('In Review', 'Done', '2026-04-08T10:00:00Z'),
      ]),
      'PROJ-12': makeIssue('PROJ-12', [
        makeStatusTransition('In Progress', 'In Review', '2026-04-05T10:00:00Z'),
        makeStatusTransition('In Review', 'Changes Requested', '2026-04-05T14:00:00Z'),
        makeStatusTransition('Changes Requested', 'In Review', '2026-04-06T09:00:00Z'),
        makeStatusTransition('In Review', 'In Progress', '2026-04-06T14:00:00Z'),
        makeStatusTransition('In Progress', 'In Review', '2026-04-07T09:00:00Z'),
        makeStatusTransition('In Review', 'Done', '2026-04-07T16:00:00Z'),
      ]),
      // No review activity at all → unavailable
      'PROJ-13': makeIssue('PROJ-13', [
        makeStatusTransition('To Do', 'In Progress', '2026-04-05T10:00:00Z'),
        makeStatusTransition('In Progress', 'Done', '2026-04-08T17:00:00Z'),
      ]),
    };

    const client = createMockClient({
      getSprintUserStories: vi.fn().mockResolvedValue({
        success: true,
        data: stories,
      }),
      getIssueWithChangelog: vi.fn().mockImplementation((key: string) => {
        const issue = iterationsResults[key];
        if (issue) return Promise.resolve({ success: true, data: issue });
        return Promise.resolve({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Not found' },
        });
      }),
    });

    const result = await calculateSprintMRIterations(client, 100);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const data = result.data;
    expect(data.sprintId).toBe(100);
    expect(data.sprintName).toBe('Sprint 1');
    expect(data.issueDetails).toHaveLength(4);

    // Available counts: [1, 2, 3] (PROJ-13 is unavailable)
    expect(data.averageIterations).toBe(2); // (1+2+3)/3 = 2.0
    expect(data.medianIterations).toBe(2);
    expect(data.maxIterations).toBe(3);

    expect(data.distribution.oneIteration).toBe(1);
    expect(data.distribution.twoIterations).toBe(1);
    expect(data.distribution.threeOrMore).toBe(1);
    expect(data.distribution.unavailable).toBe(1);
  });

  it('returns null stats when no data available', async () => {
    const stories = [makeIssue('PROJ-20'), makeIssue('PROJ-21')];

    const client = createMockClient({
      getSprintUserStories: vi.fn().mockResolvedValue({ success: true, data: stories }),
      getIssueWithChangelog: vi.fn().mockImplementation((key: string) => {
        // Both issues have no review activity
        return Promise.resolve({
          success: true,
          data: makeIssue(key, [
            makeStatusTransition('To Do', 'In Progress', '2026-04-05T10:00:00Z'),
            makeStatusTransition('In Progress', 'Done', '2026-04-08T17:00:00Z'),
          ]),
        });
      }),
    });

    const result = await calculateSprintMRIterations(client, 200);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.averageIterations).toBeNull();
    expect(result.data.medianIterations).toBeNull();
    expect(result.data.maxIterations).toBeNull();
    expect(result.data.distribution.unavailable).toBe(2);
  });

  it('propagates error if getSprintUserStories fails', async () => {
    const client = createMockClient({
      getSprintUserStories: vi.fn().mockResolvedValue({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Jira down', statusCode: 500 },
      }),
    });

    const result = await calculateSprintMRIterations(client, 300);
    expect(result.success).toBe(false);
  });
});
