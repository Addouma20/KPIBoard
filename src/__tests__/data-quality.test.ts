import { describe, it, expect } from 'vitest';
import { filterOutliers, assessDataQuality } from '../utils/data-quality';

describe('filterOutliers', () => {
  it('returns all values when none exceed threshold', () => {
    const { filtered, outlierCount } = filterOutliers([10, 20, 30]);
    expect(filtered).toEqual([10, 20, 30]);
    expect(outlierCount).toBe(0);
  });

  it('removes values above threshold (default 90 days = 2160h)', () => {
    const threshold = 90 * 24; // 2160h
    const { filtered, outlierCount } = filterOutliers([100, 2200, 500, 2161]);
    expect(filtered).toEqual([100, 500]);
    expect(outlierCount).toBe(2);
  });

  it('filters null values', () => {
    const { filtered, outlierCount } = filterOutliers([10, null, 30, null]);
    expect(filtered).toEqual([10, 30]);
    expect(outlierCount).toBe(0);
  });

  it('returns empty arrays for all-null input', () => {
    const { filtered, outlierCount } = filterOutliers([null, null]);
    expect(filtered).toEqual([]);
    expect(outlierCount).toBe(0);
  });

  it('uses custom threshold', () => {
    const { filtered, outlierCount } = filterOutliers([10, 50, 100], 60);
    expect(filtered).toEqual([10, 50]);
    expect(outlierCount).toBe(1);
  });
});

describe('assessDataQuality', () => {
  describe('confidence: high', () => {
    it('returns high confidence for adequate sample with no issues', () => {
      const result = assessDataQuality(10, 0, 0);
      expect(result.confidence).toBe('high');
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('confidence: low', () => {
    it('returns low when totalIssues < 3', () => {
      const result = assessDataQuality(2, 0, 0);
      expect(result.confidence).toBe('low');
      expect(result.warnings[0]).toContain('Échantillon trop petit');
    });

    it('returns low when usable issues < 3 after exclusions', () => {
      // total=5, excluded=2, missing=2 → usable=1
      const result = assessDataQuality(5, 2, 2);
      expect(result.confidence).toBe('low');
      expect(result.warnings[0]).toContain('exploitables');
    });
  });

  describe('confidence: medium', () => {
    it('returns medium when missing data > 30% of total', () => {
      // total=10, missing=4 → 40%
      const result = assessDataQuality(10, 0, 4);
      expect(result.confidence).toBe('medium');
      expect(result.warnings[0]).toContain('données manquantes');
    });
  });

  describe('outlier warnings', () => {
    it('adds outlier warning when outliers are excluded', () => {
      // total=10, excluded=2, missing=0 → usable=8 (>= 5 → high confidence)
      const result = assessDataQuality(10, 2, 0);
      expect(result.confidence).toBe('high');
      expect(result.warnings[0]).toContain('outlier');
    });

    it('returns medium when usable after outlier exclusion is between 3 and 4', () => {
      // total=5, excluded=2, missing=0 → usable=3 (< 5 but >= 3 → medium)
      const result = assessDataQuality(5, 2, 0);
      expect(result.confidence).toBe('medium');
    });
  });

  it('returns correct shape', () => {
    const result = assessDataQuality(10, 1, 0);
    expect(result).toMatchObject({
      totalIssues: 10,
      excludedOutliers: 1,
      missingData: 0,
    });
  });
});
