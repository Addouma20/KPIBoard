import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateSprintDevRanking } from '../kpi/dev-ranking.kpi';
import { JiraClient } from '../clients/jira-client';
import type { JiraIssue } from '../types/jira.types';

// Mock sub-KPI calculators to isolate scoring logic
vi.mock('../kpi/lead-cycle-time.kpi', () => ({
  calculateLeadCycleTime: vi.fn(),
}));
vi.mock('../kpi/mr-iterations.kpi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../kpi/mr-iterations.kpi')>();
  return { ...actual, calculateMRIterations: vi.fn() };
});
vi.mock('../kpi/bugs-per-us.kpi', () => ({
  getBugsForIssue: vi.fn(),
}));

import { calculateLeadCycleTime } from '../kpi/lead-cycle-time.kpi';
import { calculateMRIterations } from '../kpi/mr-iterations.kpi';
import { getBugsForIssue } from '../kpi/bugs-per-us.kpi';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeIssue(key: string, assignee: string, statusName = 'Done'): JiraIssue {
  return {
    key,
    id: key,
    fields: {
      summary: `Story ${key}`,
      status: { name: statusName, id: '1', statusCategory: { key: 'done', name: 'Done' } },
      issuetype: { name: 'Story', id: '10001', subtask: false },
      priority: { name: 'Medium', id: '3' },
      assignee: { displayName: assignee, name: assignee, emailAddress: `${assignee}@test.com` },
      created: '2026-01-01T09:00:00Z',
      resolutiondate: '2026-01-10T17:00:00Z',
      labels: [],
      components: [],
      issuelinks: [],
      subtasks: [],
      description: null,
    },
  };
}

function mockLeadTime(leadTimeHours: number | null, cycleDevTimeHours: number | null = null) {
  (calculateLeadCycleTime as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    success: true,
    data: { leadTimeHours, cycleDevTimeHours, ticketToMergeHours: null },
  });
}

function mockMR(iterationsCount: number | null) {
  (calculateMRIterations as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    success: true,
    data: { issueKey: 'X', iterationsCount, dataSource: 'status_transitions', reviewTransitions: [] },
  });
}

function mockBugs(count: number) {
  (getBugsForIssue as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    success: true,
    data: Array.from({ length: count }, (_, i) => ({ key: `BUG-${i}` })),
  });
}

const mockClient = {
  getSprintUserStories: vi.fn(),
} as unknown as JiraClient;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('calculateSprintDevRanking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty developers list when no stories exist', async () => {
    (mockClient.getSprintUserStories as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true, data: [],
    });

    const result = await calculateSprintDevRanking(mockClient, 1);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.developers).toHaveLength(0);
  });

  it('groups stories by assignee and counts US per dev', async () => {
    (mockClient.getSprintUserStories as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: [makeIssue('US-1', 'Alice'), makeIssue('US-2', 'Alice'), makeIssue('US-3', 'Bob')],
    });

    // Mock sub-KPI calls for each issue (3 issues × 3 mocks each)
    for (let i = 0; i < 3; i++) {
      mockLeadTime(27);
      mockMR(1);
      mockBugs(0);
    }

    const result = await calculateSprintDevRanking(mockClient, 1);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const alice = result.data.developers.find((d) => d.displayName === 'Alice');
    const bob = result.data.developers.find((d) => d.displayName === 'Bob');
    expect(alice?.usCount).toBe(2);
    expect(bob?.usCount).toBe(1);
  });

  it('counts only Done issues in usDone', async () => {
    (mockClient.getSprintUserStories as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: [
        makeIssue('US-1', 'Alice', 'Done'),
        makeIssue('US-2', 'Alice', 'In Progress'),
      ],
    });

    mockLeadTime(27); mockMR(1); mockBugs(0);
    mockLeadTime(null); mockMR(null); mockBugs(0);

    const result = await calculateSprintDevRanking(mockClient, 1);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const alice = result.data.developers.find((d) => d.displayName === 'Alice');
    expect(alice?.usDone).toBe(1);
    expect(alice?.usCount).toBe(2);
  });

  it('assigns score between 0 and 100 to each developer', async () => {
    (mockClient.getSprintUserStories as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: [makeIssue('US-1', 'Alice'), makeIssue('US-2', 'Bob')],
    });

    mockLeadTime(18); mockMR(1); mockBugs(0); // Alice — fast, clean
    mockLeadTime(54); mockMR(3); mockBugs(2); // Bob  — slow, reworked, buggy

    const result = await calculateSprintDevRanking(mockClient, 1);
    expect(result.success).toBe(true);
    if (!result.success) return;

    for (const dev of result.data.developers) {
      expect(dev.score).toBeGreaterThanOrEqual(0);
      expect(dev.score).toBeLessThanOrEqual(100);
    }
  });

  it('sorts developers by score descending', async () => {
    (mockClient.getSprintUserStories as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: [makeIssue('US-1', 'Alice'), makeIssue('US-2', 'Bob')],
    });

    mockLeadTime(18); mockMR(1); mockBugs(0); // Alice — better metrics
    mockLeadTime(90); mockMR(4); mockBugs(3); // Bob — worse metrics

    const result = await calculateSprintDevRanking(mockClient, 1);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const scores = result.data.developers.map((d) => d.score);
    expect(scores[0]!).toBeGreaterThanOrEqual(scores[1]!);
  });

  it('returns failure when getSprintUserStories fails', async () => {
    (mockClient.getSprintUserStories as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: 'Jira error',
    });

    const result = await calculateSprintDevRanking(mockClient, 1);
    expect(result.success).toBe(false);
  });
});
