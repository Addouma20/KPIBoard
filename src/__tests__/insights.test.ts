import { describe, it, expect } from 'vitest';
import {
  generateCompletionInsights,
  generateMRInsights,
  generateLeadTimeInsights,
  generateBugInsights,
  generateAllInsights,
} from '../kpi/insights';
import type {
  USCompletionRateResult,
  SprintMRIterationsResult,
  SprintLeadCycleTimeResult,
  SprintBugsResult,
} from '../types/kpi.types';

// ─── Builders ────────────────────────────────────────────────────────────────

function makeCompletionRate(overrides: Partial<USCompletionRateResult> = {}): USCompletionRateResult {
  return {
    sprintId: 1,
    sprintName: 'Sprint 1',
    totalUS: 10,
    doneByWorkflow: 8,
    doneManually: 0,
    remaining: 2,
    completionRatePercent: 80,
    workflowRatePercent: 80,
    ...overrides,
  };
}

function makeMRIterations(overrides: Partial<SprintMRIterationsResult> = {}): SprintMRIterationsResult {
  return {
    sprintId: 1,
    sprintName: 'Sprint 1',
    averageIterations: 1.2,
    medianIterations: 1,
    maxIterations: 2,
    averageReworkCount: 0.2,
    totalReworkCount: 2,
    distribution: { oneIteration: 8, twoIterations: 2, threeOrMore: 0, unavailable: 0 },
    firstTimeRightPercent: 80,
    issueDetails: [],
    ...overrides,
  };
}

function makeTimeStats(avg: number | null = null) {
  return { averageHours: avg, medianHours: avg, p85Hours: avg, minHours: avg, maxHours: avg, sampleSize: 5 };
}

function makeLeadCycleTime(overrides: Partial<SprintLeadCycleTimeResult> = {}): SprintLeadCycleTimeResult {
  return {
    sprintId: 1,
    sprintName: 'Sprint 1',
    leadTime: makeTimeStats(27),
    ticketToMerge: makeTimeStats(27),
    cycleTime: makeTimeStats(20),
    cycleDevTime: makeTimeStats(18),
    pickupTime: makeTimeStats(9),
    devActiveTime: makeTimeStats(15),
    codeReviewTime: makeTimeStats(9),
    issueDetails: [],
    wipCount: 1,
    ...overrides,
  };
}

function makeBugs(overrides: Partial<SprintBugsResult> = {}): SprintBugsResult {
  return {
    sprintId: 1,
    sprintName: 'Sprint 1',
    totalBugs: 1,
    totalActiveBugs: 1,
    totalResolvedBugs: 0,
    bugsPerUSRatio: 0.1,
    activeBugsPerUSRatio: 0.1,
    topBuggyUS: [],
    severityDistribution: { blocker: 0, critical: 0, major: 1, minor: 0 },
    issueDetails: [],
    ...overrides,
  };
}

// ─── Completion Insights ─────────────────────────────────────────────────────

describe('generateCompletionInsights', () => {
  it('generates success insight for excellent rate (>= 90%)', () => {
    const insights = generateCompletionInsights(makeCompletionRate({ completionRatePercent: 95 }));
    expect(insights.some((i) => i.id === 'comp-excellent' && i.severity === 'success')).toBe(true);
  });

  it('generates critical insight for low rate (< 50%)', () => {
    const insights = generateCompletionInsights(makeCompletionRate({ completionRatePercent: 40 }));
    expect(insights.some((i) => i.id === 'comp-low' && i.severity === 'critical')).toBe(true);
  });

  it('generates warning insight for average rate (< 70%)', () => {
    const insights = generateCompletionInsights(makeCompletionRate({ completionRatePercent: 65 }));
    expect(insights.some((i) => i.id === 'comp-warning' && i.severity === 'warning')).toBe(true);
  });

  it('generates no severity insight for rate between 70% and 89%', () => {
    const insights = generateCompletionInsights(makeCompletionRate({ completionRatePercent: 75 }));
    const ids = insights.map((i) => i.id);
    expect(ids).not.toContain('comp-excellent');
    expect(ids).not.toContain('comp-low');
    expect(ids).not.toContain('comp-warning');
  });

  it('warns about high remaining US (> 40% of total)', () => {
    // 5 remaining out of 10 = 50%
    const insights = generateCompletionInsights(
      makeCompletionRate({ totalUS: 10, remaining: 5, completionRatePercent: 50 }),
    );
    expect(insights.some((i) => i.id === 'comp-remaining')).toBe(true);
  });
});

// ─── MR Insights ─────────────────────────────────────────────────────────────

describe('generateMRInsights', () => {
  it('generates success when firstTimeRight >= 80%', () => {
    const insights = generateMRInsights(makeMRIterations({ firstTimeRightPercent: 85 }));
    expect(insights.some((i) => i.id === 'ftr-excellent')).toBe(true);
  });

  it('generates warning when firstTimeRight < 50%', () => {
    const insights = generateMRInsights(makeMRIterations({ firstTimeRightPercent: 40 }));
    expect(insights.some((i) => i.id === 'ftr-low')).toBe(true);
  });

  it('warns about high average iterations (> 2.5)', () => {
    const insights = generateMRInsights(makeMRIterations({ averageIterations: 3 }));
    expect(insights.some((i) => i.id === 'mr-high')).toBe(true);
  });

  it('warns when threeOrMore > 3', () => {
    const insights = generateMRInsights(
      makeMRIterations({ distribution: { oneIteration: 2, twoIterations: 2, threeOrMore: 4, unavailable: 0 } }),
    );
    expect(insights.some((i) => i.id === 'mr-rework')).toBe(true);
  });

  it('generates no insight when firstTimeRight is null', () => {
    const insights = generateMRInsights(makeMRIterations({ firstTimeRightPercent: null }));
    const ids = insights.map((i) => i.id);
    expect(ids).not.toContain('ftr-excellent');
    expect(ids).not.toContain('ftr-low');
  });
});

// ─── Lead Time Insights ───────────────────────────────────────────────────────

describe('generateLeadTimeInsights', () => {
  it('generates success for fast lead time (<= 3 days = 27h)', () => {
    const insights = generateLeadTimeInsights(makeLeadCycleTime({ leadTime: makeTimeStats(27) }));
    expect(insights.some((i) => i.id === 'lt-fast')).toBe(true);
  });

  it('generates critical for slow lead time (> 10 days = 90h)', () => {
    const insights = generateLeadTimeInsights(makeLeadCycleTime({ leadTime: makeTimeStats(100) }));
    expect(insights.some((i) => i.id === 'lt-slow')).toBe(true);
  });

  it('warns about slow pickup time (> 18h)', () => {
    const insights = generateLeadTimeInsights(makeLeadCycleTime({ pickupTime: makeTimeStats(20) }));
    expect(insights.some((i) => i.id === 'pickup-slow')).toBe(true);
  });

  it('warns about long code review time (> 24h)', () => {
    const insights = generateLeadTimeInsights(makeLeadCycleTime({ codeReviewTime: makeTimeStats(30) }));
    expect(insights.some((i) => i.id === 'cr-slow')).toBe(true);
  });

  it('warns about high WIP count (> 5)', () => {
    const insights = generateLeadTimeInsights(makeLeadCycleTime({ wipCount: 6 }));
    expect(insights.some((i) => i.id === 'wip-high')).toBe(true);
  });

  it('generates no insights when all metrics are null', () => {
    const insights = generateLeadTimeInsights(
      makeLeadCycleTime({
        leadTime: makeTimeStats(null),
        pickupTime: makeTimeStats(null),
        codeReviewTime: makeTimeStats(null),
        wipCount: 0,
      }),
    );
    expect(insights).toHaveLength(0);
  });
});

// ─── Bug Insights ─────────────────────────────────────────────────────────────

describe('generateBugInsights', () => {
  it('generates success for low bugs/US ratio (<= 0.2)', () => {
    const insights = generateBugInsights(makeBugs({ bugsPerUSRatio: 0.1 }));
    expect(insights.some((i) => i.id === 'bugs-low')).toBe(true);
  });

  it('generates critical for high bugs/US ratio (> 1)', () => {
    const insights = generateBugInsights(makeBugs({ bugsPerUSRatio: 1.5 }));
    expect(insights.some((i) => i.id === 'bugs-high')).toBe(true);
  });

  it('generates critical insight when blocker bugs exist', () => {
    const insights = generateBugInsights(
      makeBugs({ severityDistribution: { blocker: 2, critical: 0, major: 0, minor: 0 } }),
    );
    expect(insights.some((i) => i.id === 'bugs-blocker' && i.severity === 'critical')).toBe(true);
  });

  it('generates no blocker insight when no blockers', () => {
    const insights = generateBugInsights(
      makeBugs({ severityDistribution: { blocker: 0, critical: 1, major: 0, minor: 0 } }),
    );
    expect(insights.some((i) => i.id === 'bugs-blocker')).toBe(false);
  });

  it('generates no ratio insight when bugsPerUSRatio is null', () => {
    const insights = generateBugInsights(makeBugs({ bugsPerUSRatio: null }));
    const ids = insights.map((i) => i.id);
    expect(ids).not.toContain('bugs-low');
    expect(ids).not.toContain('bugs-high');
  });
});

// ─── generateAllInsights ──────────────────────────────────────────────────────

describe('generateAllInsights', () => {
  it('aggregates insights from all KPIs', () => {
    const insights = generateAllInsights(
      makeCompletionRate({ completionRatePercent: 95 }),
      makeMRIterations({ firstTimeRightPercent: 85 }),
      makeLeadCycleTime({ leadTime: makeTimeStats(27) }),
      makeBugs({ bugsPerUSRatio: 0.1 }),
    );
    const ids = insights.map((i) => i.id);
    expect(ids).toContain('comp-excellent');
    expect(ids).toContain('ftr-excellent');
    expect(ids).toContain('lt-fast');
    expect(ids).toContain('bugs-low');
  });

  it('returns empty array when all inputs are null', () => {
    const insights = generateAllInsights(null, null, null, null);
    expect(insights).toHaveLength(0);
  });

  it('handles partial nulls gracefully', () => {
    const insights = generateAllInsights(
      makeCompletionRate({ completionRatePercent: 95 }),
      null,
      null,
      null,
    );
    expect(insights.some((i) => i.id === 'comp-excellent')).toBe(true);
  });
});
