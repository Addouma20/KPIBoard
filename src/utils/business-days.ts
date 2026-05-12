// Business days/hours utilities
// Default: Monday-Friday, 9h-18h, Europe/Paris

interface BusinessHoursConfig {
  startHour: number;
  endHour: number;
  timezone: string;
}

const DEFAULT_CONFIG: BusinessHoursConfig = {
  startHour: 9,
  endHour: 18,
  timezone: 'Europe/Paris',
};

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function isBusinessDay(date: Date): boolean {
  return !isWeekend(date);
}

export function countBusinessDays(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);

  const endNorm = new Date(end);
  endNorm.setHours(0, 0, 0, 0);

  while (current <= endNorm) {
    if (isBusinessDay(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return Math.max(0, count);
}

export function calculateBusinessHours(
  start: Date,
  end: Date,
  config: BusinessHoursConfig = DEFAULT_CONFIG
): number {
  if (end <= start) return 0;

  const hoursPerDay = config.endHour - config.startHour;
  let totalHours = 0;
  const current = new Date(start);

  while (current < end) {
    if (isBusinessDay(current)) {
      const dayStart = new Date(current);
      dayStart.setHours(config.startHour, 0, 0, 0);

      const dayEnd = new Date(current);
      dayEnd.setHours(config.endHour, 0, 0, 0);

      const effectiveStart = current > dayStart ? current : dayStart;
      const effectiveEnd = end < dayEnd ? end : dayEnd;

      if (effectiveStart < effectiveEnd) {
        const hours = (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60);
        totalHours += Math.min(hours, hoursPerDay);
      }
    }

    // Move to next day start
    current.setDate(current.getDate() + 1);
    current.setHours(config.startHour, 0, 0, 0);
  }

  return Math.round(totalHours * 10) / 10;
}

export function hoursToBusinessDays(
  hours: number,
  config: BusinessHoursConfig = DEFAULT_CONFIG
): number {
  const hoursPerDay = config.endHour - config.startHour;
  return Math.round((hours / hoursPerDay) * 10) / 10;
}
