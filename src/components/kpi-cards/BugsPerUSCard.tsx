import React from 'react';
import type { SprintBugsResult } from '../../types/kpi.types';
import { getThresholdLevel, BUGS_PER_US_THRESHOLDS } from '../../kpi/thresholds.config';
import KPITooltip from './KPITooltip';

interface BugsPerUSCardProps {
  data: SprintBugsResult | null;
  isLoading: boolean;
  error: string | null;
}

const SEVERITY_COLORS: Record<string, string> = {
  blocker: '#CD3C14',
  critical: '#E05E00',
  major: '#FF7900',
  minor: '#32C832',
};

const BugsPerUSCard: React.FC<BugsPerUSCardProps> = ({ data, isLoading, error }) => {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm animate-pulse min-h-[220px]">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-6" />
        <div className="h-12 bg-gray-200 rounded w-1/4 mb-6" />
        <div className="flex justify-center mb-4">
          <div className="h-24 w-24 bg-gray-200 rounded-full" />
        </div>
        <div className="h-3 bg-gray-200 rounded w-2/3" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm min-h-[220px]">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Bugs par US</h3>
        <p className="text-red-500 text-sm">{error}</p>
        <p className="text-gray-400 text-xs mt-2">Vérifiez la connexion Jira et réessayez.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm min-h-[220px]">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Bugs par US</h3>
        <p className="text-gray-400 text-sm">Aucune donnée disponible.</p>
      </div>
    );
  }

  const ratioValue = data.bugsPerUSRatio ?? 0;
  const threshold = getThresholdLevel(ratioValue, BUGS_PER_US_THRESHOLDS);

  // Build conic gradient segments for donut
  const severities = ['blocker', 'critical', 'major', 'minor'] as const;
  const segments: { key: string; count: number; color: string }[] = severities
    .map((s) => ({ key: s, count: data.severityDistribution[s], color: SEVERITY_COLORS[s] ?? '#94a3b8' }))
    .filter((s) => s.count > 0);

  const totalSegments = segments.reduce((sum, s) => sum + s.count, 0);
  let gradientParts: string[] = [];
  let cumulative = 0;

  if (totalSegments > 0) {
    segments.forEach((seg) => {
      const start = (cumulative / totalSegments) * 360;
      cumulative += seg.count;
      const end = (cumulative / totalSegments) * 360;
      gradientParts.push(`${seg.color} ${start}deg ${end}deg`);
    });
  }

  const conicGradient =
    gradientParts.length > 0
      ? `conic-gradient(${gradientParts.join(', ')})`
      : '#e5e7eb';

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm min-h-[220px] flex flex-col">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-1">
        <KPITooltip text={"KPI Bugs — Ratio bugs par US\n\nFormule : Total Bugs liés aux US du sprint / Total US du sprint (Done + WIP)\n\nUn bug est lié à une US par :\n• Lien Jira direct (inward/outward, tout type)\n• Référence à la clé US dans le titre/description\n• Même sprint + même composant\n• Sous-tâche de type Bug de l'US\nDéduplication par clé : priorité au lien le plus direct.\n\nScore pondéré par sévérité :\n• Blocker = 3 pts · Critical = 3 pts\n• Major = 2 pts · Minor = 1 pt\n\nDistingue bugs actifs (ouverts) et résolus."}>
          🐛 Bugs par US
        </KPITooltip>
      </h3>

      <div className="flex items-baseline gap-3 mb-4 mt-2">
        <span className="text-5xl font-extrabold tabular-nums" style={{ color: threshold.color }}>
          {ratioValue.toFixed(2)}
        </span>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ backgroundColor: `${threshold.color}15`, color: threshold.color }}
        >
          {threshold.label}
        </span>
      </div>

      {/* CSS donut chart */}
      {totalSegments > 0 && (
        <div className="flex items-center gap-5 mb-4">
          <div
            className="w-24 h-24 rounded-full flex-shrink-0"
            style={{
              background: conicGradient,
              mask: 'radial-gradient(circle at center, transparent 55%, black 56%)',
              WebkitMask: 'radial-gradient(circle at center, transparent 55%, black 56%)',
            }}
          />
          <div className="flex flex-col gap-1.5">
            {segments.map((seg) => (
              <span key={seg.key} className="flex items-center gap-2 text-xs text-gray-500">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="capitalize">{seg.key}</span>
                <span className="font-semibold text-gray-700">{seg.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto space-y-1">
        <p className="text-sm text-gray-600 font-medium">
          {data.totalBugs} bugs / {data.issueDetails.length} US
        </p>
        <p className="text-xs text-gray-400">
          Actifs : {data.totalActiveBugs} · Résolus : {data.totalResolvedBugs}
        </p>
      </div>
    </div>
  );
};

export default BugsPerUSCard;
