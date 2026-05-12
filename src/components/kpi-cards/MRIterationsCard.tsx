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
const MRWorkflowSchema: React.FC = () => (
  <div className="my-3 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-[10px] font-mono text-slate-500 overflow-x-auto">
    <div className="flex items-center gap-0.5 whitespace-nowrap mb-1">
      <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">MR ouverte</span>
      <span className="text-slate-400">→</span>
      <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">In Review</span>
      <span className="text-slate-400">→</span>
      <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700">Merged ✓</span>
      <span className="text-slate-300 mx-1">|</span>
      <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">Changes ↩</span>
      <span className="text-slate-400">→</span>
      <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">In Progress</span>
      <span className="text-slate-400">→ ...</span>
    </div>
    <div className="flex text-[9px] text-slate-400 gap-4 mt-1 pl-1">
      <span>
        <span className="inline-block w-2 h-0.5 bg-green-400 mr-1 align-middle" />
        KPI 1 : <strong className="text-green-600">Taux Approbation 1er passage</strong> = MR merged sans aucun &quot;Changes&quot;
      </span>
      <span>
        <span className="inline-block w-2 h-0.5 bg-orange-400 mr-1 align-middle" />
        KPI 2 : <strong className="text-orange-600">Indice Rework</strong> = nb moyen d&apos;allers-retours
      </span>
    </div>
  </div>
);

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
        <KPITooltip text={"KPI 1 — Taux d'Approbation (1er passage)\n% de MR fusionnées sans aucune modification demandée.\nMesure : Est-ce que le code est 'bon du premier coup' ?\n\n100% = toutes les MR approuvées sans retour.\n< 60% = l'agent produit du code qui nécessite souvent des corrections."}> 
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

      {/* Schema */}
      <MRWorkflowSchema />

      {/* KPI 2: Indice de Rework — SECONDARY */}
      <div className="rounded-xl bg-orange-50 border border-orange-100 px-4 py-3 mb-4">
        <p className="text-xs text-gray-500 mb-1">
          <KPITooltip text={"KPI 2 — Indice de Rework (Allers-retours)\nNb moyen d'allers-retours (corrections) par MR.\n0.0 = toutes les MR approuv\u00e9es sans correction.\n1.0 = 1 cycle de corrections par MR en moyenne.\n2+ = l'agent produit souvent du code à reprendre."}>
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
