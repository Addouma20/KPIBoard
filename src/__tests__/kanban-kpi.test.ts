import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateKanbanMRIterations } from '../kpi/kanban-kpi';
import type { JiraIssue } from '../types/jira.types';
import { JiraClient } from '../clients/jira-client';

// Mock calculateMRIterations from mr-iterations.kpi so tests are deterministic
vi.mock('../kpi/mr-iterations.kpi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../kpi/mr-iterations.kpi')>();
  return {
    ...actual,
    calculateMRIterations: vi.fn(),
  };
});

import { calculateMRIterations } from '../kpi/mr-iterations.kpi';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeStory(key: string): JiraIssue {
  return {
    key,
    id: key,
    fields: {
      summary: `Story ${key}`,
      status: { name: 'Done', id: '1', statusCategory: { key: 'done', name: 'Done' } },
      issuetype: { name: 'Story', id: '10001', subtask: false },
      priority: { name: 'Medium', id: '3' },
      assignee: null,
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

function mockIterations(key: string, count: number | null) {
  (calculateMRIterations as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    success: true,
    data: {
      issueKey: key,
      iterationsCount: count,
      dataSource: 'status_transitions',
      reviewTransitions: [],
    },
  });
}

const mockClient = {} as JiraClient;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('calculateKanbanMRIterations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null metrics for empty story list', async () => {
    const result = await calculateKanbanMRIterations(mockClient, [], 'Jan 2026');
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.averageIterations).toBeNull();
    expect(result.data.averageReworkCount).toBeNull();
    expect(result.data.totalReworkCount).toBeNull();
    expect(result.data.firstTimeRightPercent).toBeNull();
  });

  it('computes totalReworkCount = 0 when all stories pass on first review (1 iteration)', async () => {
    mockIterations('US-1', 1);
    mockIterations('US-2', 1);
    mockIterations('US-3', 1);

    const result = await calculateKanbanMRIterations(mockClient, [makeStory('US-1'), makeStory('US-2'), makeStory('US-3')], 'Sprint');
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.totalReworkCount).toBe(0);
    expect(result.data.averageReworkCount).toBe(0);
    expect(result.data.firstTimeRightPercent).toBe(100);
  });

  it('computes correct totalReworkCount and averageReworkCount for mixed iterations', async () => {
    // US-1: 1 iteration → 0 rework
    // US-2: 2 iterations → 1 rework
    // US-3: 3 iterations → 2 reworks
    // Total rework = 0 + 1 + 2 = 3, average = 3/3 = 1.0
    mockIterations('US-1', 1);
    mockIterations('US-2', 2);
    mockIterations('US-3', 3);

    const result = await calculateKanbanMRIterations(
      mockClient,
      [makeStory('US-1'), makeStory('US-2'), makeStory('US-3')],
      'Sprint',
    );
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.totalReworkCount).toBe(3);
    expect(result.data.averageReworkCount).toBe(1);
  });

  it('computes firstTimeRightPercent correctly', async () => {
    // 2 out of 4 pass on first iteration → 50%
    mockIterations('US-1', 1);
    mockIterations('US-2', 1);
    mockIterations('US-3', 2);
    mockIterations('US-4', 3);

    const result = await calculateKanbanMRIterations(
      mockClient,
      [makeStory('US-1'), makeStory('US-2'), makeStory('US-3'), makeStory('US-4')],
      'Sprint',
    );
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.firstTimeRightPercent).toBe(50);
  });

  it('handles unavailable iteration data (null counts)', async () => {
    mockIterations('US-1', null);
    mockIterations('US-2', null);

    const result = await calculateKanbanMRIterations(
      mockClient,
      [makeStory('US-1'), makeStory('US-2')],
      'Sprint',
    );
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.averageIterations).toBeNull();
    expect(result.data.totalReworkCount).toBeNull();
    expect(result.data.distribution.unavailable).toBe(2);
  });

  it('builds the distribution correctly', async () => {
    mockIterations('US-1', 1); // oneIteration
    mockIterations('US-2', 1); // oneIteration
    mockIterations('US-3', 2); // twoIterations
    mockIterations('US-4', 4); // threeOrMore

    const result = await calculateKanbanMRIterations(
      mockClient,
      [makeStory('US-1'), makeStory('US-2'), makeStory('US-3'), makeStory('US-4')],
      'Sprint',
    );
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.distribution).toEqual({
      oneIteration: 2,
      twoIterations: 1,
      threeOrMore: 1,
      unavailable: 0,
    });
  });
});
