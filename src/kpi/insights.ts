/**
 * MT1: Auto-insights module.
 * Generates analysis phrases from KPI data.
 */
import type {
  SprintMRIterationsResult,
  SprintLeadCycleTimeResult,
  SprintBugsResult,
  USCompletionRateResult,
  Insight,
  InsightSeverity,
} from '../types/kpi.types';

function makeInsight(
  id: string,
  severity: InsightSeverity,
  category: Insight['category'],
  message: string,
  metric: string,
  value: number | null,
  delta: number | null = null,
): Insight {
  return { id, severity, category, message, metric, value, delta };
}

export function generateCompletionInsights(
  data: USCompletionRateResult,
): Insight[] {
  const insights: Insight[] = [];
  const rate = data.completionRatePercent;

  if (rate >= 90) {
    insights.push(makeInsight('comp-excellent', 'success', 'performance',
      `Taux d'achèvement excellent : ${rate}%`, 'completionRate', rate));
  } else if (rate < 50) {
    insights.push(makeInsight('comp-low', 'critical', 'performance',
      `Taux d'achèvement faible : ${rate}%. Risque de dérive.`, 'completionRate', rate));
  } else if (rate < 70) {
    insights.push(makeInsight('comp-warning', 'warning', 'performance',
      `Taux d'achèvement moyen : ${rate}%. À surveiller.`, 'completionRate', rate));
  }

  if (data.totalUS > 0 && data.remaining > data.totalUS * 0.4) {
    insights.push(makeInsight('comp-remaining', 'warning', 'performance',
      `${data.remaining} US encore en cours sur ${data.totalUS} — charge potentiellement élevée.`,
      'remainingUS', data.remaining));
  }

  return insights;
}

export function generateMRInsights(
  data: SprintMRIterationsResult,
): Insight[] {
  const insights: Insight[] = [];

  if (data.firstTimeRightPercent !== null) {
    if (data.firstTimeRightPercent >= 80) {
      insights.push(makeInsight('ftr-excellent', 'success', 'quality',
        `First Time Right à ${data.firstTimeRightPercent}% — qualité de code élevée.`,
        'firstTimeRight', data.firstTimeRightPercent));
    } else if (data.firstTimeRightPercent < 50) {
      insights.push(makeInsight('ftr-low', 'warning', 'quality',
        `First Time Right à ${data.firstTimeRightPercent}% — les US nécessitent plusieurs itérations de review.`,
        'firstTimeRight', data.firstTimeRightPercent));
    }
  }

  if (data.averageIterations !== null && data.averageIterations > 2.5) {
    insights.push(makeInsight('mr-high', 'warning', 'quality',
      `Moyenne de ${data.averageIterations} itérations MR — processus de review potentiellement lourd.`,
      'avgMRIterations', data.averageIterations));
  }

  if (data.distribution.threeOrMore > 3) {
    insights.push(makeInsight('mr-rework', 'warning', 'quality',
      `${data.distribution.threeOrMore} US avec 3+ itérations de review — vérifier les critères d'acceptation.`,
      'threeOrMoreIterations', data.distribution.threeOrMore));
  }

  return insights;
}

export function generateLeadTimeInsights(
  data: SprintLeadCycleTimeResult,
): Insight[] {
  const insights: Insight[] = [];

  if (data.leadTime.averageHours !== null) {
    const leadDays = Math.round(data.leadTime.averageHours / 9 * 10) / 10;
    if (leadDays <= 3) {
      insights.push(makeInsight('lt-fast', 'success', 'performance',
        `Lead Time moyen de ${leadDays}j — livraison rapide.`, 'avgLeadTimeDays', leadDays));
    } else if (leadDays > 10) {
      insights.push(makeInsight('lt-slow', 'critical', 'performance',
        `Lead Time moyen de ${leadDays}j — délai de livraison élevé.`, 'avgLeadTimeDays', leadDays));
    }
  }

  if (data.pickupTime?.averageHours !== null && data.pickupTime.averageHours > 18) {
    const pickupDays = Math.round(data.pickupTime.averageHours / 9 * 10) / 10;
    insights.push(makeInsight('pickup-slow', 'warning', 'performance',
      `Pickup Time moyen de ${pickupDays}j — les US restent longtemps en attente avant d'être prises.`,
      'avgPickupTimeDays', pickupDays));
  }

  if (data.codeReviewTime.averageHours !== null && data.codeReviewTime.averageHours > 24) {
    insights.push(makeInsight('cr-slow', 'warning', 'team',
      `Code Review moyen de ${Math.round(data.codeReviewTime.averageHours)}h — processus de review à optimiser.`,
      'avgCodeReviewHours', data.codeReviewTime.averageHours));
  }

  if (data.wipCount > 5) {
    insights.push(makeInsight('wip-high', 'warning', 'team',
      `${data.wipCount} US encore en WIP — limiter le travail en parallèle.`,
      'wipCount', data.wipCount));
  }

  return insights;
}

export function generateBugInsights(
  data: SprintBugsResult,
): Insight[] {
  const insights: Insight[] = [];

  if (data.bugsPerUSRatio !== null) {
    if (data.bugsPerUSRatio <= 0.2) {
      insights.push(makeInsight('bugs-low', 'success', 'quality',
        `Ratio bugs/US de ${Math.round(data.bugsPerUSRatio * 100) / 100} — très bonne qualité.`,
        'bugsPerUS', data.bugsPerUSRatio));
    } else if (data.bugsPerUSRatio > 1) {
      insights.push(makeInsight('bugs-high', 'critical', 'quality',
        `Ratio bugs/US de ${Math.round(data.bugsPerUSRatio * 100) / 100} — qualité préoccupante.`,
        'bugsPerUS', data.bugsPerUSRatio));
    }
  }

  if (data.severityDistribution.blocker > 0) {
    insights.push(makeInsight('bugs-blocker', 'critical', 'quality',
      `${data.severityDistribution.blocker} bug(s) bloquant(s) détecté(s).`,
      'blockerBugs', data.severityDistribution.blocker));
  }

  return insights;
}

export function generateAllInsights(
  completionRate: USCompletionRateResult | null,
  mrIterations: SprintMRIterationsResult | null,
  leadCycleTime: SprintLeadCycleTimeResult | null,
  bugs: SprintBugsResult | null,
): Insight[] {
  const insights: Insight[] = [];
  if (completionRate) insights.push(...generateCompletionInsights(completionRate));
  if (mrIterations) insights.push(...generateMRInsights(mrIterations));
  if (leadCycleTime) insights.push(...generateLeadTimeInsights(leadCycleTime));
  if (bugs) insights.push(...generateBugInsights(bugs));
  return insights;
}
