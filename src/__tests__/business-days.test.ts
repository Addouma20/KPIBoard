import { describe, it, expect } from 'vitest';
import {
  isWeekend,
  isBusinessDay,
  countBusinessDays,
  calculateBusinessHours,
  hoursToBusinessDays,
} from '../utils/business-days';

// 2026-01-05 = Monday, …, 2026-01-09 = Friday, 2026-01-10 = Saturday, 2026-01-11 = Sunday
const MON = new Date('2026-01-05T10:00:00');
const TUE = new Date('2026-01-06T10:00:00');
const WED = new Date('2026-01-07T10:00:00');
const FRI = new Date('2026-01-09T10:00:00');
const SAT = new Date('2026-01-10T10:00:00');
const SUN = new Date('2026-01-11T10:00:00');
const NEXT_MON = new Date('2026-01-12T10:00:00');

describe('isWeekend', () => {
  it('returns false for weekdays', () => {
    expect(isWeekend(MON)).toBe(false);
    expect(isWeekend(TUE)).toBe(false);
    expect(isWeekend(FRI)).toBe(false);
  });

  it('returns true for Saturday and Sunday', () => {
    expect(isWeekend(SAT)).toBe(true);
    expect(isWeekend(SUN)).toBe(true);
  });
});

describe('isBusinessDay', () => {
  it('returns true for weekdays', () => {
    expect(isBusinessDay(MON)).toBe(true);
    expect(isBusinessDay(WED)).toBe(true);
  });

  it('returns false for weekend days', () => {
    expect(isBusinessDay(SAT)).toBe(false);
    expect(isBusinessDay(SUN)).toBe(false);
  });
});

describe('countBusinessDays', () => {
  it('counts 1 for same-day (business day)', () => {
    expect(countBusinessDays(MON, MON)).toBe(1);
  });

  it('counts 0 for same-day on a weekend', () => {
    expect(countBusinessDays(SAT, SAT)).toBe(0);
  });

  it('counts 2 for Monday to Tuesday', () => {
    expect(countBusinessDays(MON, TUE)).toBe(2);
  });

  it('counts 5 for Monday to Friday (full week)', () => {
    expect(countBusinessDays(MON, FRI)).toBe(5);
  });

  it('skips weekend days when spanning into next week', () => {
    // Mon Jan 5 → Mon Jan 12: Mon+Tue+Wed+Thu+Fri+Mon = 6 business days
    expect(countBusinessDays(MON, NEXT_MON)).toBe(6);
  });

  it('counts 0 when spanning only weekend days', () => {
    expect(countBusinessDays(SAT, SUN)).toBe(0);
  });

  it('returns 0 when end is before start', () => {
    expect(countBusinessDays(FRI, MON)).toBe(0);
  });
});

describe('calculateBusinessHours', () => {
  it('returns 0 when end equals start', () => {
    const d = new Date('2026-01-05T10:00:00');
    expect(calculateBusinessHours(d, d)).toBe(0);
  });

  it('returns 0 when end is before start', () => {
    const start = new Date('2026-01-05T15:00:00');
    const end = new Date('2026-01-05T10:00:00');
    expect(calculateBusinessHours(start, end)).toBe(0);
  });

  it('counts hours within a single business day', () => {
    // 10:00 → 14:00 = 4 hours
    const start = new Date('2026-01-05T10:00:00');
    const end = new Date('2026-01-05T14:00:00');
    expect(calculateBusinessHours(start, end)).toBe(4);
  });

  it('caps at max business hours per day (9h)', () => {
    // 08:00 → 20:00 spans beyond 9-18 window → should count only 9h
    const start = new Date('2026-01-05T08:00:00');
    const end = new Date('2026-01-05T20:00:00');
    expect(calculateBusinessHours(start, end)).toBe(9);
  });

  it('excludes weekend hours when spanning into next week', () => {
    // Friday 14:00 → Monday 11:00
    // Friday: 14:00 → 18:00 = 4h; Sat/Sun = 0; Monday: 9:00 → 11:00 = 2h → total 6h
    const start = new Date('2026-01-09T14:00:00'); // Friday
    const end = new Date('2026-01-12T11:00:00');   // Monday
    expect(calculateBusinessHours(start, end)).toBe(6);
  });
});

describe('hoursToBusinessDays', () => {
  it('converts 9 hours to 1 day (default 9h/day)', () => {
    expect(hoursToBusinessDays(9)).toBe(1);
  });

  it('converts 4.5 hours to 0.5 days', () => {
    expect(hoursToBusinessDays(4.5)).toBe(0.5);
  });

  it('converts 27 hours to 3 days', () => {
    expect(hoursToBusinessDays(27)).toBe(3);
  });

  it('converts 0 to 0', () => {
    expect(hoursToBusinessDays(0)).toBe(0);
  });
});
