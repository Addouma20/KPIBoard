import { describe, it, expect } from 'vitest';
import {
  getThresholdLevel,
  getCompletionRateThreshold,
  getFirstTimeRightThreshold,
  LEAD_TIME_THRESHOLDS,
  MR_ITERATIONS_THRESHOLDS,
  BUGS_PER_US_THRESHOLDS,
} from '../kpi/thresholds.config';

describe('getThresholdLevel — Lead Time', () => {
  it('returns excellent for <= 3 days', () => {
    expect(getThresholdLevel(1, LEAD_TIME_THRESHOLDS).label).toBe('<= 3 jours');
    expect(getThresholdLevel(3, LEAD_TIME_THRESHOLDS).label).toBe('<= 3 jours');
  });

  it('returns good for <= 5 days', () => {
    expect(getThresholdLevel(4, LEAD_TIME_THRESHOLDS).label).toBe('<= 5 jours');
    expect(getThresholdLevel(5, LEAD_TIME_THRESHOLDS).label).toBe('<= 5 jours');
  });

  it('returns warning for <= 10 days', () => {
    expect(getThresholdLevel(7, LEAD_TIME_THRESHOLDS).label).toBe('<= 10 jours');
    expect(getThresholdLevel(10, LEAD_TIME_THRESHOLDS).label).toBe('<= 10 jours');
  });

  it('returns critical for > 10 days', () => {
    expect(getThresholdLevel(11, LEAD_TIME_THRESHOLDS).label).toBe('> 10 jours');
    expect(getThresholdLevel(100, LEAD_TIME_THRESHOLDS).label).toBe('> 10 jours');
  });
});

describe('getThresholdLevel — MR Iterations (Rework)', () => {
  it('returns excellent for <= 0.2', () => {
    expect(getThresholdLevel(0, MR_ITERATIONS_THRESHOLDS).color).toBe('#22c55e');
    expect(getThresholdLevel(0.2, MR_ITERATIONS_THRESHOLDS).color).toBe('#22c55e');
  });

  it('returns good for <= 0.8', () => {
    expect(getThresholdLevel(0.5, MR_ITERATIONS_THRESHOLDS).label).toBe('Bon');
  });

  it('returns warning for <= 1.5', () => {
    expect(getThresholdLevel(1.0, MR_ITERATIONS_THRESHOLDS).label).toBe('A surveiller');
  });

  it('returns critical for > 1.5', () => {
    expect(getThresholdLevel(2.0, MR_ITERATIONS_THRESHOLDS).label).toBe('Critique');
    expect(getThresholdLevel(2.0, MR_ITERATIONS_THRESHOLDS).color).toBe('#ef4444');
  });
});

describe('getThresholdLevel — Bugs per US', () => {
  it('returns excellent for <= 0.2', () => {
    expect(getThresholdLevel(0.1, BUGS_PER_US_THRESHOLDS).label).toBe('<= 0.2 bug/US');
  });

  it('returns critical for > 1', () => {
    expect(getThresholdLevel(1.5, BUGS_PER_US_THRESHOLDS).label).toBe('> 1 bug/US');
  });
});

describe('getCompletionRateThreshold', () => {
  it('returns excellent for >= 80%', () => {
    expect(getCompletionRateThreshold(80).color).toBe('#22c55e');
    expect(getCompletionRateThreshold(100).color).toBe('#22c55e');
  });

  it('returns good for >= 60%', () => {
    expect(getCompletionRateThreshold(60).color).toBe('#84cc16');
    expect(getCompletionRateThreshold(79).color).toBe('#84cc16');
  });

  it('returns warning for >= 40%', () => {
    expect(getCompletionRateThreshold(40).color).toBe('#f59e0b');
  });

  it('returns critical for < 40%', () => {
    expect(getCompletionRateThreshold(39).color).toBe('#ef4444');
    expect(getCompletionRateThreshold(0).color).toBe('#ef4444');
  });
});

describe('getFirstTimeRightThreshold', () => {
  it('returns excellent for >= 80%', () => {
    expect(getFirstTimeRightThreshold(80).color).toBe('#22c55e');
    expect(getFirstTimeRightThreshold(100).color).toBe('#22c55e');
  });

  it('returns good for >= 60%', () => {
    expect(getFirstTimeRightThreshold(60).color).toBe('#84cc16');
    expect(getFirstTimeRightThreshold(79).color).toBe('#84cc16');
  });

  it('returns warning for >= 40%', () => {
    expect(getFirstTimeRightThreshold(40).color).toBe('#f59e0b');
    expect(getFirstTimeRightThreshold(59).color).toBe('#f59e0b');
  });

  it('returns critical for < 40%', () => {
    expect(getFirstTimeRightThreshold(39).color).toBe('#ef4444');
    expect(getFirstTimeRightThreshold(0).color).toBe('#ef4444');
  });
});
