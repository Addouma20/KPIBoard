import React from 'react';
import type { USCompletionRateResult } from '../../types/kpi.types';
import { getCompletionRateThreshold } from '../../kpi/thresholds.config';
import KPITooltip from './KPITooltip';

interface CompletionRateCardProps {
  data: USCompletionRateResult | null;
  isLoading: boolean;
  error: string | null;
}

const CompletionRateCard: React.FC<CompletionRateCardProps> = ({ data, isLoading, error }) => {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm animate-pulse min-h-[220px]">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-6" />
        <div className="h-12 bg-gray-200 rounded w-1/3 mb-6" />
        <div className="h-3 bg-gray-200 rounded w-full mb-4" />
        <div className="h-3 bg-gray-200 rounded w-2/3" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm min-h-[220px]">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Taux de complétion US</h3>
        <p className="text-red-500 text-sm">{error}</p>
        <p className="text-gray-400 text-xs mt-2">Vérifiez la connexion Jira et réessayez.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm min-h-[220px]">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Taux de complétion US</h3>
        <p className="text-gray-400 text-sm">Aucune donnée disponible.</p>
      </div>
    );
  }

  const threshold = getCompletionRateThreshold(data.completionRatePercent);
  const totalDone = data.doneByWorkflow + data.doneManually;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm min-h-[220px] flex flex-col">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-1">
        <KPITooltip text={"Pourcentage d'US terminées (Done) par rapport au total des US du sprint.\n\nFormule : (US Done / Total US) × 100\n\nDistingue les US terminées par le workflow automatisé (compte de service) de celles terminées manuellement.\nLes Bug et Sub-task sont exclus du calcul."}>
          ✅ Taux de complétion US
        </KPITooltip>
      </h3>

      <div className="flex items-baseline gap-3 mb-4 mt-2">
        <span className="text-5xl font-extrabold tabular-nums" style={{ color: threshold.color }}>
          {data.completionRatePercent.toFixed(0)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden mb-4">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${Math.min(data.completionRatePercent, 100)}%`,
            backgroundColor: threshold.color,
          }}
        />
      </div>

      <div className="mt-auto">
        <p className="text-sm text-gray-600 font-medium">
          {totalDone} / {data.totalUS} US Done
        </p>
      </div>
    </div>
  );
};

export default CompletionRateCard;
