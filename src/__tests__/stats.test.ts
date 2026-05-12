import { describe, it, expect } from 'vitest';
import { average, median, percentile, min, max, roundTo } from '../utils/stats';

describe('average', () => {
  it('returns null for empty array', () => {
    expect(average([])).toBeNull();
  });

  it('returns the value for a single-element array', () => {
    expect(average([5])).toBe(5);
  });

  it('computes correct average', () => {
    expect(average([1, 2, 3, 4, 5])).toBe(3);
  });

  it('rounds to 1 decimal place', () => {
    expect(average([1, 2])).toBe(1.5);
    expect(average([1, 1, 2])).toBe(1.3);
  });

  it('handles decimal values', () => {
    expect(average([0.1, 0.2, 0.3])).toBe(0.2);
  });
});

describe('median', () => {
  it('returns null for empty array', () => {
    expect(median([])).toBeNull();
  });

  it('returns the only value for single-element array', () => {
    expect(median([7])).toBe(7);
  });

  it('returns middle value for odd-length array', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([5, 9, 1, 3, 7])).toBe(5);
  });

  it('returns average of two middle values for even-length array', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([10, 20])).toBe(15);
  });

  it('does not mutate the input array', () => {
    const arr = [3, 1, 2];
    median(arr);
    expect(arr).toEqual([3, 1, 2]);
  });
});

describe('percentile', () => {
  it('returns null for empty array', () => {
    expect(percentile([], 85)).toBeNull();
  });

  it('p100 returns the maximum', () => {
    expect(percentile([1, 2, 3, 4, 5], 100)).toBe(5);
  });

  it('computes p50 (median-like)', () => {
    const result = percentile([10, 20, 30, 40, 50], 50);
    expect(result).toBe(30);
  });

  it('computes p85 on a known dataset', () => {
    // sorted: [1,2,3,4,5,6,7,8,9,10] → ceil(85/100 * 10) - 1 = index 7 → value 8
    const result = percentile([5, 3, 8, 1, 9, 2, 4, 7, 6, 10], 85);
    expect(result).toBe(9);
  });
});

describe('min', () => {
  it('returns null for empty array', () => {
    expect(min([])).toBeNull();
  });

  it('returns the smallest value', () => {
    expect(min([5, 3, 8, 1, 9])).toBe(1);
  });

  it('handles negative numbers', () => {
    expect(min([-5, 0, 5])).toBe(-5);
  });
});

describe('max', () => {
  it('returns null for empty array', () => {
    expect(max([])).toBeNull();
  });

  it('returns the largest value', () => {
    expect(max([5, 3, 8, 1, 9])).toBe(9);
  });

  it('handles negative numbers', () => {
    expect(max([-5, -1, -3])).toBe(-1);
  });
});

describe('roundTo', () => {
  it('rounds to 0 decimals', () => {
    expect(roundTo(2.6, 0)).toBe(3);
    expect(roundTo(2.4, 0)).toBe(2);
  });

  it('rounds to 1 decimal', () => {
    expect(roundTo(2.55, 1)).toBe(2.6);
    expect(roundTo(1.234, 1)).toBe(1.2);
  });

  it('rounds to 2 decimals', () => {
    expect(roundTo(3.14159, 2)).toBe(3.14);
  });

  it('does not alter integers', () => {
    expect(roundTo(5, 2)).toBe(5);
  });
});
