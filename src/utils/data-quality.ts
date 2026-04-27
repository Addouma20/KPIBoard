/**
 * MT6: Data quality indicators.
 * QW6: Outlier filtering (Lead Time > 90 days excluded from averages).
 */
import type { DataQuality } from '../types/kpi.types';

const LEAD_TIME_OUTLIER_THRESHOLD_HOURS = 90 * 24; // 90 days
const MIN_SIGNIFICANT_SAMPLE = 3;

export function filterOutliers(
  values: (number | null)[],
  thresholdHours: number = LEAD_TIME_OUTLIER_THRESHOLD_HOURS,
): { filtered: number[]; outlierCount: number } {
  const valid = values.filter((v): v is number => v !== null);
  const outliers = valid.filter((v) => v > thresholdHours);
  const filtered = valid.filter((v) => v <= thresholdHours);
  return { filtered, outlierCount: outliers.length };
}

export function assessDataQuality(
  totalIssues: number,
  excludedOutliers: number,
  missingData: number,
): DataQuality {
  const warnings: string[] = [];
  let confidence: DataQuality['confidence'] = 'high';

  const usable = totalIssues - excludedOutliers - missingData;

  if (totalIssues < MIN_SIGNIFICANT_SAMPLE) {
    confidence = 'low';
    warnings.push(`Échantillon trop petit (${totalIssues} US) — résultats non significatifs.`);
  } else if (usable < MIN_SIGNIFICANT_SAMPLE) {
    confidence = 'low';
    warnings.push(`Seulement ${usable} US exploitables après exclusion des outliers et données manquantes.`);
  } else if (missingData > totalIssues * 0.3) {
    confidence = 'medium';
    warnings.push(`${missingData} US avec données manquantes (${Math.round(missingData / totalIssues * 100)}%).`);
  } else if (excludedOutliers > 0) {
    confidence = usable >= 5 ? 'high' : 'medium';
    warnings.push(`${excludedOutliers} outlier(s) exclu(s) (Lead Time > 90j).`);
  }

  return {
    totalIssues,
    excludedOutliers,
    missingData,
    confidence,
    warnings,
  };
}
