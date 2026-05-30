import React from 'react';
import type { SprintMRIterationsResult } from '../../types/kpi.types';
import { getThresholdLevel, MR_ITERATIONS_THRESHOLDS, getFirstTimeRightThreshold } from '../../kpi/thresholds.config';
import KPITooltip from './KPITooltip';

interface MRIterationsCardProps {
  data: SprintMRIterationsResult | null;
  isLoading: boolean;
  error: string | null;
}

/** Inline workflow schema: PR lifecycle with iteration brackets */
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
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Approbation MR / Rework</h3>
        <p className="text-red-500 text-sm">{error}</p>
        <p className="text-gray-400 text-xs mt-2">Vérifiez la connexion Jira et réessayez.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm min-h-[220px]">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Approbation MR / Rework</h3>
        <p className="text-gray-400 text-sm">Aucune donnée disponible.</p>
      </div>
    );
  }

  // KPI 1: First-Time Right (primary) — % MRs merged on first review, no changes requested
  const ftrThreshold = data.firstTimeRightPercent !== null
    ? getFirstTimeRightThreshold(data.firstTimeRightPercent)
    : { color: '#9ca3af', label: 'Aucune revue détectée' };

  // KPI 2: Rework Index (secondary) — average allers-retours per MR (0 = first time right)
  const reworkThreshold = data.averageReworkCount !== null
    ? getThresholdLevel(data.averageReworkCount, MR_ITERATIONS_THRESHOLDS)
    : { color: '#9ca3af', label: '—' };

  const { oneIteration, twoIterations, threeOrMore } = data.distribution;
  const total = oneIteration + twoIterations + threeOrMore;

  const barHeight = (count: number) => {
    if (total === 0) return 0;
    return Math.round((count / total) * 100);
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm min-h-[220px] flex flex-col">
      {/* KPI 1: Taux d'Approbation (1er passage) — PRIMARY */}
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-1">
        <KPITooltip text={"KPI 1 — Taux d'Approbation (1er passage)\n\nFormule : US approuvées en 1 seule itération / Total US avec activité de review × 100\n\nSource (par priorité) :\n1. Champ custom Jira (customfield_iterations, configurable)\n2. Transitions changelog : In Review → Changes Requested / In Progress\n\niterationsCount = 1 → approuvé directement (first-time right)\niterationsCount = N → N-1 allers-retours\n\n100% = toutes les US approuvées sans retour.\n< 60% = le code nécessite souvent des corrections."}> 
          ✅ Taux d&apos;Approbation <span className="normal-case text-gray-300 font-normal">(1er passage)</span>
        </KPITooltip>
      </h3>

      <div className="flex items-baseline gap-3 mb-1 mt-2">
        <span className="text-5xl font-extrabold tabular-nums" style={{ color: ftrThreshold.color }}>
          {data.firstTimeRightPercent !== null ? `${data.firstTimeRightPercent}%` : '—'}
        </span>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ backgroundColor: `${ftrThreshold.color}15`, color: ftrThreshold.color }}
        >
          {ftrThreshold.label}
        </span>
      </div>
      <p className="text-[10px] text-gray-400 mb-2">MR fusionnées sans demande de modification</p>

      {/* KPI 2: Indice de Rework — SECONDARY */}
      <div className="rounded-xl bg-orange-50 border border-orange-100 px-4 py-3 mb-4">
        <p className="text-xs text-gray-500 mb-1">
          <KPITooltip text={"KPI 2 — Indice de Rework\n\nFormule : Moyenne des (itérations − 1) par US avec données de review\n\niterationsCount = 1 → 0 aller-retour (first-time right)\niterationsCount = 2 → 1 aller-retour\niterationsCount = N → N-1 allers-retours\n\nDétection d'une itération :\n• In Review → Changes Requested\n• In Review → In Progress (retour en dév)\n\n0.0 = aucune correction nécessaire.\n1.0 = 1 aller-retour par MR en moyenne.\n2+ = qualité du code insuffisante."}>
            🔄 Indice de Rework
          </KPITooltip>
        </p>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-extrabold tabular-nums" style={{ color: reworkThreshold.color }}>
            {data.averageReworkCount !== null ? data.averageReworkCount.toFixed(1) : '—'}
          </span>
          <span className="text-xs text-gray-400">allers-retours moy</span>
        </div>
      </div>

      {/* Distribution bar chart */}
      <div className="flex items-end gap-4 h-16 mt-auto">
        {[
          { label: '1× ✓', count: oneIteration, color: '#22c55e' },
          { label: '2×', count: twoIterations, color: '#f59e0b' },
          { label: '3+×', count: threeOrMore, color: '#ef4444' },
        ].map((bar) => (
          <div key={bar.label} className="flex flex-col items-center flex-1">
            <span className="text-xs font-semibold text-gray-600 mb-1">{bar.count}</span>
            <div
              className="w-full rounded-lg transition-all duration-700 ease-out"
              style={{
                height: `${Math.max(barHeight(bar.count), 6)}%`,
                backgroundColor: bar.color,
                minHeight: '4px',
              }}
            />
            <span className="text-[10px] text-gray-400 mt-1">{bar.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MRIterationsCard;
