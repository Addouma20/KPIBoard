// KPI threshold configuration
// Defines green/orange/red zones for each KPI

export interface ThresholdLevel {
  max: number;
  color: string;
  label: string;
}

export interface ThresholdConfig {
  excellent: ThresholdLevel;
  good: ThresholdLevel;
  warning: ThresholdLevel;
  critical: ThresholdLevel;
}

// EPIC-02: Completion Rate (percentage)
export const COMPLETION_RATE_THRESHOLDS: ThresholdConfig = {
  excellent: { max: 100, color: '#22c55e', label: '>= 80%' },
  good:      { max: 80,  color: '#84cc16', label: '>= 60%' },
  warning:   { max: 60,  color: '#f59e0b', label: '>= 40%' },
  critical:  { max: 40,  color: '#ef4444', label: '< 40%' },
};

// EPIC-03: MR Iterations (average count)
export const MR_ITERATIONS_THRESHOLDS: ThresholdConfig = {
  excellent: { max: 1.2,      color: '#22c55e', label: 'Excellent' },
  good:      { max: 1.8,      color: '#84cc16', label: 'Bon' },
  warning:   { max: 2.5,      color: '#f59e0b', label: 'A surveiller' },
  critical:  { max: Infinity,  color: '#ef4444', label: 'Critique' },
};

// EPIC-04: Lead Time (business days)
export const LEAD_TIME_THRESHOLDS: ThresholdConfig = {
  excellent: { max: 3,        color: '#22c55e', label: '<= 3 jours' },
  good:      { max: 5,        color: '#84cc16', label: '<= 5 jours' },
  warning:   { max: 10,       color: '#f59e0b', label: '<= 10 jours' },
  critical:  { max: Infinity, color: '#ef4444', label: '> 10 jours' },
};

// EPIC-04: Code Review Time (hours)
export const CODE_REVIEW_THRESHOLDS: ThresholdConfig = {
  excellent: { max: 4,        color: '#22c55e', label: '<= 4h' },
  good:      { max: 8,        color: '#84cc16', label: '<= 8h' },
  warning:   { max: 24,       color: '#f59e0b', label: '<= 24h' },
  critical:  { max: Infinity, color: '#ef4444', label: '> 24h' },
};

// EPIC-05: Bugs per US (ratio)
export const BUGS_PER_US_THRESHOLDS: ThresholdConfig = {
  excellent: { max: 0.2,      color: '#22c55e', label: '<= 0.2 bug/US' },
  good:      { max: 0.5,      color: '#84cc16', label: '<= 0.5 bug/US' },
  warning:   { max: 1.0,      color: '#f59e0b', label: '<= 1 bug/US' },
  critical:  { max: Infinity, color: '#ef4444', label: '> 1 bug/US' },
};

// QW1: First Time Right Rate (percentage, higher is better)
export const FIRST_TIME_RIGHT_THRESHOLDS: ThresholdConfig = {
  excellent: { max: 100,      color: '#22c55e', label: '>= 80%' },
  good:      { max: 80,       color: '#84cc16', label: '>= 60%' },
  warning:   { max: 60,       color: '#f59e0b', label: '>= 40%' },
  critical:  { max: 40,       color: '#ef4444', label: '< 40%' },
};

export function getFirstTimeRightThreshold(percent: number): ThresholdLevel {
  if (percent >= 80) return FIRST_TIME_RIGHT_THRESHOLDS.excellent;
  if (percent >= 60) return FIRST_TIME_RIGHT_THRESHOLDS.good;
  if (percent >= 40) return FIRST_TIME_RIGHT_THRESHOLDS.warning;
  return FIRST_TIME_RIGHT_THRESHOLDS.critical;
}

export function getThresholdLevel(value: number, thresholds: ThresholdConfig): ThresholdLevel {
  if (value <= thresholds.excellent.max) return thresholds.excellent;
  if (value <= thresholds.good.max) return thresholds.good;
  if (value <= thresholds.warning.max) return thresholds.warning;
  return thresholds.critical;
}

// For completion rate, higher is better (invert logic)
export function getCompletionRateThreshold(percent: number): ThresholdLevel {
  if (percent >= 80) return COMPLETION_RATE_THRESHOLDS.excellent;
  if (percent >= 60) return COMPLETION_RATE_THRESHOLDS.good;
  if (percent >= 40) return COMPLETION_RATE_THRESHOLDS.warning;
  return COMPLETION_RATE_THRESHOLDS.critical;
}
