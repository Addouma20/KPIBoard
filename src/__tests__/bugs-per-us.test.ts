import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mapBugSeverity,
  mapBugStatus,
  getBugsForIssue,
  calculateSprintBugs,
} from '../kpi/bugs-per-us.kpi';
import type { JiraClient } from '../clients/jira-client';
import type { JiraIssue } from '../types';
import { success } from '../types/result.types';

function makeLinkedBug(key: string, priority: string, status: string) {
  return {
    key,
    fields: {
      summary: `Bug ${key}`,
      status: { name: status, id: '1', statusCategory: { key: 'done', name: 'Done' } },
      issuetype: { name: 'Bug', id: '10', subtask: false },
      priority: { name: priority, id: '1' },
    },
  };
}

function makeIssue(overrides: Partial<JiraIssue> & { key: string }): JiraIssue {
  return {
    key: overrides.key,
    id: overrides.id ?? overrides.key,
    fields: {
      summary: `Summary ${overrides.key}`,
      status: { name: 'Done', id: '1', statusCategory: { key: 'done', name: 'Done' } },
      issuetype: { name: 'Story', id: '10', subtask: false },
      priority: { name: 'Medium', id: '3' },
      assignee: null,
      created: '2026-04-01T10:00:00.000Z',
      resolutiondate: '2026-04-10T10:00:00.000Z',
      labels: [],
      components: [],
      issuelinks: [],
      subtasks: [],
      description: null,
      ...overrides.fields,
    },
    changelog: overrides.changelog,
  } as JiraIssue;
}

function createMockClient(overrides: Partial<JiraClient> = {}): JiraClient {
  return {
    getIssueWithChangelog: vi.fn(),
    searchIssues: vi.fn().mockResolvedValue(success([])),
    getSprintIssues: vi.fn(),
    getSprintUserStories: vi.fn(),
    getBoards: vi.fn(),
    getSprints: vi.fn(),
    getConfig: vi.fn(),
    getProjectKey: vi.fn().mockReturnValue('PROJ'),
    invalidateCache: vi.fn(),
    ...overrides,
  } as unknown as JiraClient;
}

describe('mapBugSeverity', () => {
  it('maps Blocker to blocker', () => {
    expect(mapBugSeverity('Blocker')).toBe('blocker');
  });

  it('maps Critical to critical', () => {
    expect(mapBugSeverity('Critical')).toBe('critical');
  });

  it('maps Highest to blocker', () => {
    expect(mapBugSeverity('Highest')).toBe('blocker');
  });

  it('maps High to critical', () => {
    expect(mapBugSeverity('High')).toBe('critical');
  });

  it('maps Major to major', () => {
    expect(mapBugSeverity('Major')).toBe('major');
  });

  it('maps Medium to major', () => {
    expect(mapBugSeverity('Medium')).toBe('major');
  });

  it('maps Minor to minor', () => {
    expect(mapBugSeverity('Minor')).toBe('minor');
  });

  it('maps Low to minor', () => {
    expect(mapBugSeverity('Low')).toBe('minor');
  });

  it('defaults unknown priority to minor', () => {
    expect(mapBugSeverity('Unknown')).toBe('minor');
  });
});

describe('mapBugStatus', () => {
  it('maps Closed to closed', () => {
    expect(mapBugStatus('Closed')).toBe('closed');
  });

  it('maps CLOSED to closed', () => {
    expect(mapBugStatus('CLOSED')).toBe('closed');
  });

  it('maps Done to resolved', () => {
    expect(mapBugStatus('Done')).toBe('resolved');
  });

  it('maps Resolved to resolved', () => {
    expect(mapBugStatus('Resolved')).toBe('resolved');
  });

  it('maps Fixed to resolved', () => {
    expect(mapBugStatus('Fixed')).toBe('resolved');
  });

  it('maps In Progress to in_progress', () => {
    expect(mapBugStatus('In Progress')).toBe('in_progress');
  });

  it('maps Open to open', () => {
    expect(mapBugStatus('Open')).toBe('open');
  });

  it('maps To Do to open', () => {
    expect(mapBugStatus('To Do')).toBe('open');
  });
});

describe('getBugsForIssue', () => {
  let mockClient: JiraClient;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  it('finds bugs via issue links', async () => {
    const linkedBug = makeLinkedBug('BUG-1', 'Major', 'Open');

    vi.mocked(mockClient.getIssueWithChangelog).mockResolvedValue(
      success(
        makeIssue({
          key: 'US-1',
          fields: {
            issuelinks: [
              {
                id: '1',
                type: { name: 'Causes', inward: 'is caused by', outward: 'causes' },
                outwardIssue: linkedBug,
              },
            ],
            subtasks: [],
            components: [],
          } as Partial<JiraIssue['fields']> as JiraIssue['fields'],
        }),
      ),
    );

    const result = await getBugsForIssue(mockClient, 'US-1', 100);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].key).toBe('BUG-1');
      expect(result.data[0].linkMethod).toBe('issue_link');
      expect(result.data[0].severity).toBe('major');
    }
  });

  it('deduplicates bugs found by multiple methods', async () => {
    const linkedBug = makeLinkedBug('BUG-1', 'Major', 'Open');

    vi.mocked(mockClient.getIssueWithChangelog).mockResolvedValue(
      success(
        makeIssue({
          key: 'US-1',
          fields: {
            issuelinks: [
              {
                id: '1',
                type: { name: 'Causes', inward: 'is caused by', outward: 'causes' },
                outwardIssue: linkedBug,
              },
            ],
            subtasks: [],
            components: [],
          } as Partial<JiraIssue['fields']> as JiraIssue['fields'],
        }),
      ),
    );

    // Same bug found via text search
    vi.mocked(mockClient.searchIssues).mockResolvedValue(
      success([
        makeIssue({
          key: 'BUG-1',
          fields: {
            issuetype: { name: 'Bug', id: '10', subtask: false },
            priority: { name: 'Major', id: '3' },
            status: { name: 'Open', id: '1', statusCategory: { key: 'new', name: 'To Do' } },
          } as Partial<JiraIssue['fields']> as JiraIssue['fields'],
        }),
      ]),
    );

    const result = await getBugsForIssue(mockClient, 'US-1', 100);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      // Should keep issue_link (higher priority)
      expect(result.data[0].linkMethod).toBe('issue_link');
    }
  });

  it('distinguishes active vs resolved bugs', async () => {
    const openBug = makeLinkedBug('BUG-1', 'Major', 'Open');
    const inProgressBug = makeLinkedBug('BUG-2', 'Minor', 'In Progress');
    const doneBug = makeLinkedBug('BUG-3', 'Minor', 'Done');
    const closedBug = makeLinkedBug('BUG-4', 'Critical', 'Closed');

    vi.mocked(mockClient.getIssueWithChangelog).mockResolvedValue(
      success(
        makeIssue({
          key: 'US-1',
          fields: {
            issuelinks: [
              { id: '1', type: { name: 'Causes', inward: 'is caused by', outward: 'causes' }, outwardIssue: openBug },
              { id: '2', type: { name: 'Causes', inward: 'is caused by', outward: 'causes' }, outwardIssue: inProgressBug },
              { id: '3', type: { name: 'Causes', inward: 'is caused by', outward: 'causes' }, outwardIssue: doneBug },
              { id: '4', type: { name: 'Causes', inward: 'is caused by', outward: 'causes' }, outwardIssue: closedBug },
            ],
            subtasks: [],
            components: [],
          } as Partial<JiraIssue['fields']> as JiraIssue['fields'],
        }),
      ),
    );

    const result = await getBugsForIssue(mockClient, 'US-1', 100);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(4);
      const statuses = result.data.map(b => b.status);
      expect(statuses).toContain('open');
      expect(statuses).toContain('in_progress');
      expect(statuses).toContain('resolved');
      expect(statuses).toContain('closed');
    }
  });

  it('finds bugs via subtasks', async () => {
    vi.mocked(mockClient.getIssueWithChangelog).mockResolvedValue(
      success(
        makeIssue({
          key: 'US-1',
          fields: {
            issuelinks: [],
            subtasks: [
              {
                key: 'US-1-SUB-1',
                fields: {
                  summary: 'Bug subtask',
                  status: { name: 'Open', id: '1', statusCategory: { key: 'new', name: 'To Do' } },
                  issuetype: { name: 'Bug', id: '10', subtask: true },
                },
              },
              {
                key: 'US-1-SUB-2',
                fields: {
                  summary: 'Normal subtask',
                  status: { name: 'Open', id: '1', statusCategory: { key: 'new', name: 'To Do' } },
                  issuetype: { name: 'Sub-task', id: '11', subtask: true },
                },
              },
            ],
            components: [],
          } as Partial<JiraIssue['fields']> as JiraIssue['fields'],
        }),
      ),
    );

    const result = await getBugsForIssue(mockClient, 'US-1', 100);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].key).toBe('US-1-SUB-1');
      expect(result.data[0].linkMethod).toBe('subtask');
    }
  });

  it('calculates weightedScore correctly', async () => {
    const blockerBug = makeLinkedBug('BUG-1', 'Blocker', 'Open');
    const majorBug = makeLinkedBug('BUG-2', 'Major', 'Open');
    const minorBug = makeLinkedBug('BUG-3', 'Minor', 'Open');

    vi.mocked(mockClient.getIssueWithChangelog).mockResolvedValue(
      success(
        makeIssue({
          key: 'US-1',
          fields: {
            issuelinks: [
              { id: '1', type: { name: 'Causes', inward: 'is caused by', outward: 'causes' }, outwardIssue: blockerBug },
              { id: '2', type: { name: 'Causes', inward: 'is caused by', outward: 'causes' }, outwardIssue: majorBug },
              { id: '3', type: { name: 'Causes', inward: 'is caused by', outward: 'causes' }, outwardIssue: minorBug },
            ],
            subtasks: [],
            components: [],
          } as Partial<JiraIssue['fields']> as JiraIssue['fields'],
        }),
      ),
    );

    const result = await getBugsForIssue(mockClient, 'US-1', 100);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.find(b => b.key === 'BUG-1')?.weightedScore).toBe(3); // blocker
      expect(result.data.find(b => b.key === 'BUG-2')?.weightedScore).toBe(2); // major
      expect(result.data.find(b => b.key === 'BUG-3')?.weightedScore).toBe(1); // minor
    }
  });
});

describe('calculateSprintBugs', () => {
  let mockClient: JiraClient;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  it('sprint aggregation returns correct ratio', async () => {
    const us1 = makeIssue({
      key: 'US-1',
      fields: {
        issuetype: { name: 'Story', id: '10', subtask: false },
        status: { name: 'Done', id: '3', statusCategory: { key: 'done', name: 'Done' } },
        issuelinks: [
          {
            id: '1',
            type: { name: 'Causes', inward: 'is caused by', outward: 'causes' },
            outwardIssue: makeLinkedBug('BUG-1', 'Major', 'Open'),
          },
          {
            id: '2',
            type: { name: 'Causes', inward: 'is caused by', outward: 'causes' },
            outwardIssue: makeLinkedBug('BUG-2', 'Minor', 'Closed'),
          },
        ],
        subtasks: [],
        components: [],
      } as Partial<JiraIssue['fields']> as JiraIssue['fields'],
    });

    const us2 = makeIssue({
      key: 'US-2',
      fields: {
        issuetype: { name: 'Story', id: '10', subtask: false },
        status: { name: 'Done', id: '3', statusCategory: { key: 'done', name: 'Done' } },
        issuelinks: [
          {
            id: '3',
            type: { name: 'Causes', inward: 'is caused by', outward: 'causes' },
            outwardIssue: makeLinkedBug('BUG-3', 'Critical', 'Done'),
          },
        ],
        subtasks: [],
        components: [],
      } as Partial<JiraIssue['fields']> as JiraIssue['fields'],
    });

    vi.mocked(mockClient.getSprintIssues).mockResolvedValue(success([us1, us2]));

    const result = await calculateSprintBugs(mockClient, 100);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalBugs).toBe(3);
      expect(result.data.totalActiveBugs).toBe(1); // BUG-1 is Open
      expect(result.data.totalResolvedBugs).toBe(2); // BUG-2 closed, BUG-3 resolved
      // 3 bugs / 2 done US = 1.5
      expect(result.data.bugsPerUSRatio).toBe(1.5);
    }
  });

  it('returns null ratio if 0 US Done', async () => {
    const us1 = makeIssue({
      key: 'US-1',
      fields: {
        issuetype: { name: 'Story', id: '10', subtask: false },
        status: { name: 'In Progress', id: '2', statusCategory: { key: 'indeterminate', name: 'In Progress' } },
        issuelinks: [
          {
            id: '1',
            type: { name: 'Causes', inward: 'is caused by', outward: 'causes' },
            outwardIssue: makeLinkedBug('BUG-1', 'Major', 'Open'),
          },
        ],
        subtasks: [],
        components: [],
      } as Partial<JiraIssue['fields']> as JiraIssue['fields'],
    });

    vi.mocked(mockClient.getSprintIssues).mockResolvedValue(success([us1]));

    const result = await calculateSprintBugs(mockClient, 100);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bugsPerUSRatio).toBeNull();
      expect(result.data.activeBugsPerUSRatio).toBeNull();
    }
  });

  it('identifies top 5 buggiest US', async () => {
    const issues = Array.from({ length: 7 }, (_, i) => {
      const bugCount = 7 - i; // US-1 has 7 bugs, US-7 has 1
      const issuelinks = Array.from({ length: bugCount }, (_, j) => ({
        id: `${i}-${j}`,
        type: { name: 'Causes', inward: 'is caused by', outward: 'causes' },
        outwardIssue: makeLinkedBug(`BUG-${i}-${j}`, 'Minor', 'Open'),
      }));

      return makeIssue({
        key: `US-${i + 1}`,
        fields: {
          summary: `Story ${i + 1}`,
          issuetype: { name: 'Story', id: '10', subtask: false },
          status: { name: 'Done', id: '3', statusCategory: { key: 'done', name: 'Done' } },
          issuelinks,
          subtasks: [],
          components: [],
        } as Partial<JiraIssue['fields']> as JiraIssue['fields'],
      });
    });

    vi.mocked(mockClient.getSprintIssues).mockResolvedValue(success(issues));

    const result = await calculateSprintBugs(mockClient, 100);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.topBuggyUS).toHaveLength(5);
      expect(result.data.topBuggyUS[0].issueKey).toBe('US-1');
      expect(result.data.topBuggyUS[0].totalBugs).toBe(7);
      expect(result.data.topBuggyUS[4].issueKey).toBe('US-5');
      expect(result.data.topBuggyUS[4].totalBugs).toBe(3);
    }
  });

  it('excludes Bug and Sub-task issue types from user stories', async () => {
    const us1 = makeIssue({
      key: 'US-1',
      fields: {
        issuetype: { name: 'Story', id: '10', subtask: false },
        status: { name: 'Done', id: '3', statusCategory: { key: 'done', name: 'Done' } },
        issuelinks: [],
        subtasks: [],
        components: [],
      } as Partial<JiraIssue['fields']> as JiraIssue['fields'],
    });

    const bug = makeIssue({
      key: 'BUG-1',
      fields: {
        issuetype: { name: 'Bug', id: '11', subtask: false },
        status: { name: 'Open', id: '1', statusCategory: { key: 'new', name: 'To Do' } },
        issuelinks: [],
        subtasks: [],
        components: [],
      } as Partial<JiraIssue['fields']> as JiraIssue['fields'],
    });

    vi.mocked(mockClient.getSprintIssues).mockResolvedValue(success([us1, bug]));

    const result = await calculateSprintBugs(mockClient, 100);

    expect(result.success).toBe(true);
    if (result.success) {
      // Only US-1 should appear in issueDetails, not BUG-1
      expect(result.data.issueDetails).toHaveLength(1);
      expect(result.data.issueDetails[0].issueKey).toBe('US-1');
    }
  });

  it('computes severity distribution across all US', async () => {
    const us1 = makeIssue({
      key: 'US-1',
      fields: {
        issuetype: { name: 'Story', id: '10', subtask: false },
        status: { name: 'Done', id: '3', statusCategory: { key: 'done', name: 'Done' } },
        issuelinks: [
          { id: '1', type: { name: 'Causes', inward: 'is caused by', outward: 'causes' }, outwardIssue: makeLinkedBug('BUG-1', 'Blocker', 'Open') },
          { id: '2', type: { name: 'Causes', inward: 'is caused by', outward: 'causes' }, outwardIssue: makeLinkedBug('BUG-2', 'Major', 'Open') },
          { id: '3', type: { name: 'Causes', inward: 'is caused by', outward: 'causes' }, outwardIssue: makeLinkedBug('BUG-3', 'Minor', 'Closed') },
        ],
        subtasks: [],
        components: [],
      } as Partial<JiraIssue['fields']> as JiraIssue['fields'],
    });

    vi.mocked(mockClient.getSprintIssues).mockResolvedValue(success([us1]));

    const result = await calculateSprintBugs(mockClient, 100);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.severityDistribution).toEqual({
        blocker: 1,
        critical: 0,
        major: 1,
        minor: 1,
      });
    }
  });
});
