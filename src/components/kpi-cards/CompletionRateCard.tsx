import React from 'react';
import type { USCompletionRateResult } from '../../types/kpi.types';
import { getFirstTimeRightThreshold } from '../../kpi/thresholds.config';
import KPITooltip from './KPITooltip';

interface CompletionRateCardProps {
  data: USCompletionRateResult | null;
  isLoading: boolean;
  error: string | null;
}

/** Inline schema for KPI 3: Ticket lifecycle — human vs agent close */
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
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Taux d&apos;Autonomie E2E</h3>
        <p className="text-red-500 text-sm">{error}</p>
        <p className="text-gray-400 text-xs mt-2">Vérifiez la connexion Jira et réessayez.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm min-h-[220px]">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Taux d&apos;Autonomie E2E</h3>
        <p className="text-gray-400 text-sm">Aucune donnée disponible.</p>
      </div>
    );
  }

  // KPI 3: Taux d'Autonomie E2E = workflowRatePercent (primary)
  const autonomieThreshold = getFirstTimeRightThreshold(data.workflowRatePercent);
  const totalDone = data.doneByWorkflow + data.doneManually;

  // Stacked bar: workflow (agent) vs manual
  const agentPct = totalDone > 0 ? Math.round((data.doneByWorkflow / totalDone) * 100) : 0;
  const humanPct = 100 - agentPct;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm min-h-[220px] flex flex-col">
      {/* KPI 3 primary: Taux d'Autonomie E2E */}
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-1">
        <KPITooltip text={"Taux d'Autonomie E2E — Réalisation par le Workflow\n\nTaux d'autonomie = US Done par workflow / Total US Done × 100\nTaux de complétion = Total US Done / Total US du sprint × 100\n\nUne US est 'Done par workflow' si la transition finale vers Done est effectuée par le compte de service (non par un humain).\n\n100% = l'agent a fermé tous les tickets seul.\n< 50% = l'humain intervient souvent pour finaliser."}>
          🤖 Taux d&apos;Autonomie <span className="normal-case text-gray-300 font-normal">(E2E)</span>
        </KPITooltip>
      </h3>

      <div className="flex items-baseline gap-3 mb-1 mt-2">
        <span className="text-5xl font-extrabold tabular-nums" style={{ color: autonomieThreshold.color }}>
          {data.workflowRatePercent.toFixed(0)}%
        </span>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ backgroundColor: `${autonomieThreshold.color}15`, color: autonomieThreshold.color }}
        >
          {autonomieThreshold.label}
        </span>
      </div>
      <p className="text-[10px] text-gray-400 mb-2">Tickets clos par l&apos;agent sans intervention humaine</p>

      {/* Stats: US réalisées */}
      <div className="flex items-center gap-3 mb-2">
        <span className="text-sm font-semibold text-gray-700">
          {data.doneByWorkflow + data.doneManually} US réalisées
        </span>
        <span className="text-xs text-gray-400">sur {data.totalUS} US Dev</span>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600"
        >
          {data.completionRatePercent.toFixed(0)}% complétées
        </span>
      </div>

      {/* Stacked bar: Agent vs Human */}
      {totalDone > 0 && (
        <div className="mt-auto">
          <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
            <div
              className="transition-all duration-700 ease-out"
              style={{ width: `${agentPct}%`, backgroundColor: autonomieThreshold.color }}
              title={`Agent: ${agentPct}%`}
            />
            <div
              className="transition-all duration-700 ease-out"
              style={{ width: `${humanPct}%`, backgroundColor: '#94a3b8' }}
              title={`Humain: ${humanPct}%`}
            />
          </div>
          <div className="flex text-[10px] text-gray-400 mt-1.5 gap-4">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: autonomieThreshold.color }} />
              Agent : {data.doneByWorkflow} / {data.totalUS} US Dev
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-slate-400" />
              Humain : {data.doneManually} US
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompletionRateCard;
