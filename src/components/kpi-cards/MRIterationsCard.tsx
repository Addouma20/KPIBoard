import React from 'react';
import type { SprintMRIterationsResult } from '../../types/kpi.types';
import { getThresholdLevel, MR_ITERATIONS_THRESHOLDS } from '../../kpi/thresholds.config';
import KPITooltip from './KPITooltip';

interface MRIterationsCardProps {
  data: SprintMRIterationsResult | null;
  isLoading: boolean;
  error: string | null;
}

const MRIterationsCard: React.FC<MRIterationsCardProps> = ({ data, isLoading, error }) => {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm animate-pulse min-h-[220px]">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-6" />
        <div className="h-12 bg-gray-200 rounded w-1/4 mb-6" />
        <div className="flex gap-3 mb-4">
          <div className="h-20 bg-gray-200 rounded flex-1" />
          <div className="h-20 bg-gray-200 rounded flex-1" />
          <div className="h-20 bg-gray-200 rounded flex-1" />
        </div>
        <div className="h-3 bg-gray-200 rounded w-1/2" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm min-h-[220px]">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Itérations MR</h3>
        <p className="text-red-500 text-sm">{error}</p>
        <p className="text-gray-400 text-xs mt-2">Vérifiez la connexion Jira et réessayez.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm min-h-[220px]">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Itérations MR</h3>
        <p className="text-gray-400 text-sm">Aucune donnée disponible.</p>
      </div>
    );
  }

  const threshold = data.averageIterations !== null
    ? getThresholdLevel(data.averageIterations, MR_ITERATIONS_THRESHOLDS)
    : { color: '#9ca3af', label: 'Pas de revue détectée' };
  const { oneIteration, twoIterations, threeOrMore } = data.distribution;
  const total = oneIteration + twoIterations + threeOrMore;

  const barHeight = (count: number) => {
    if (total === 0) return 0;
    return Math.round((count / total) * 100);
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm min-h-[220px] flex flex-col">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-1">
        <KPITooltip text={"Nombre moyen d'allers-retours en revue de code (Merge Request) avant approbation.\n\nCompte les transitions entre les statuts In Review et Changes Requested.\n1 itération = revue approuvée du premier coup.\n2+ = des modifications ont été demandées.\n\nDistribution : 1 iter (vert), 2 iter (orange), 3+ (rouge)."}>
          🔄 Itérations MR
        </KPITooltip>
      </h3>

      <div className="flex items-baseline gap-3 mb-4 mt-2">
        <span className="text-5xl font-extrabold tabular-nums" style={{ color: threshold.color }}>
          {data.averageIterations !== null ? data.averageIterations.toFixed(1) : '—'}
        </span>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ backgroundColor: `${threshold.color}15`, color: threshold.color }}
        >
          {threshold.label}
        </span>
      </div>

      {/* Mini bar chart */}
      <div className="flex items-end gap-4 h-24 mb-4 flex-1">
        {[
          { label: '1 iter', count: oneIteration, color: '#22c55e' },
          { label: '2 iter', count: twoIterations, color: '#f59e0b' },
          { label: '3+', count: threeOrMore, color: '#ef4444' },
        ].map((bar) => (
          <div key={bar.label} className="flex flex-col items-center flex-1">
            <span className="text-sm font-semibold text-gray-600 mb-1">{bar.count}</span>
            <div
              className="w-full rounded-lg transition-all duration-700 ease-out"
              style={{
                height: `${Math.max(barHeight(bar.count), 6)}%`,
                backgroundColor: bar.color,
                minHeight: '4px',
              }}
            />
            <span className="text-xs text-gray-400 mt-1.5">{bar.label}</span>
          </div>
        ))}
      </div>

      <p className="text-sm text-gray-500 mt-auto">
        Médiane : {data.medianIterations !== null ? data.medianIterations.toFixed(1) : '—'}
      </p>
    </div>
  );
};

export default MRIterationsCard;
