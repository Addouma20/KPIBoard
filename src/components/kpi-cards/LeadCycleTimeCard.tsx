import React from 'react';
import type { SprintLeadCycleTimeResult } from '../../types/kpi.types';
import { getThresholdLevel, LEAD_TIME_THRESHOLDS } from '../../kpi/thresholds.config';
import KPITooltip from './KPITooltip';

/** Workflow schema showing Lead Time and Cycle Time / Ticket-to-Merge brackets */
const LeadTimeSchema: React.FC = () => (
  <div className="my-3 rounded-xl bg-slate-50 border border-slate-100 px-3 pt-2 pb-3 text-[10px] font-mono text-slate-500 overflow-x-auto">
    {/* Status nodes */}
    <div className="flex items-center gap-0.5 whitespace-nowrap mb-2">
      <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Backlog</span>
      <span className="text-slate-400">→</span>
      <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">Ready</span>
      <span className="text-slate-400">→</span>
      <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold">In Progress</span>
      <span className="text-slate-400">→</span>
      <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">Code Review</span>
      <span className="text-slate-400">→</span>
      <span className="px-1.5 py-0.5 rounded bg-teal-100 text-teal-700">QA</span>
      <span className="text-slate-400">→</span>
      <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-bold">Done ✓</span>
    </div>
    {/* Bracket: Lead Time */}
    <div className="relative pl-10 mb-0.5">
      <span className="text-[9px] text-slate-400 mr-1 border-l border-b border-slate-300 px-1 py-0.5">
        ←──────────────────────── LEAD TIME (Ready → Done) ────────────────────────→
      </span>
    </div>
    {/* Bracket: Ticket to Merge */}
    <div className="relative pl-28 mb-0.5">
      <span className="text-[9px] text-indigo-500 font-semibold border-l border-b border-indigo-300 px-1 py-0.5">
        ←──────── ⭐ TICKET TO MERGE (In Progress → Done) ────────→
      </span>
    </div>
  </div>
);

interface LeadCycleTimeCardProps {
  data: SprintLeadCycleTimeResult | null;
  isLoading: boolean;
  error: string | null;
}

const BUSINESS_HOURS_PER_DAY = 9;

const LeadCycleTimeCard: React.FC<LeadCycleTimeCardProps> = ({ data, isLoading, error }) => {

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm animate-pulse min-h-[220px]">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-6" />
        <div className="h-12 bg-gray-200 rounded w-1/4 mb-6" />
        <div className="h-4 bg-gray-200 rounded w-full mb-4" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm min-h-[220px]">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Lead Time</h3>
        <p className="text-red-500 text-sm">{error}</p>
        <p className="text-gray-400 text-xs mt-2">Vérifiez la connexion Jira et réessayez.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm min-h-[220px]">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Lead Time</h3>
        <p className="text-gray-400 text-sm">Aucune donnée disponible pour ce sprint.</p>
      </div>
    );
  }

  // KPI 4 primary: Ticket to Merge (In Progress → Done)
  const hasTicketToMergeMedian = data.ticketToMerge.medianHours !== null;
  const ticketToMergeDays = hasTicketToMergeMedian ? data.ticketToMerge.medianHours! / BUSINESS_HOURS_PER_DAY : null;
  const threshold = ticketToMergeDays !== null ? getThresholdLevel(ticketToMergeDays, LEAD_TIME_THRESHOLDS) : null;
  const p85Days = data.ticketToMerge.p85Hours !== null
    ? (data.ticketToMerge.p85Hours / BUSINESS_HOURS_PER_DAY).toFixed(1)
    : '—';

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm min-h-[220px] flex flex-col">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-1">
        <KPITooltip text={"KPI 4 — Lead Time (Ticket to Merge)\nTemps écoulé entre le premier statut 'In Progress' (Jira) et 'Done' (Merged).\nMesure la vitesse réelle de livraison.\n\nCalculé en jours ouvrés (lun-ven, 9h-18h).\n1 jour ouvré = 9 heures.\n\nDifférence avec le Lead Time complet (Ready→Done) :\n- Lead Time = inclut le temps d'attente en backlog.\n- Ticket to Merge = commence quand l'agent commence réellement à coder."}>
          ⏱ Lead Time <span className="normal-case text-gray-300 font-normal">(Ticket to Merge)</span>
        </KPITooltip>
      </h3>
      <p className="text-xs text-gray-400 mb-1">In Progress → Done/Merged (jours ouvrés)</p>

      {/* KPI 4 primary metric: Ticket to Merge */}
      {ticketToMergeDays !== null && threshold !== null ? (
        <div className="flex items-baseline gap-3 mb-1">
          <span className="text-5xl font-extrabold tabular-nums" style={{ color: threshold.color }}>
            {ticketToMergeDays.toFixed(1)}j
          </span>
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: `${threshold.color}15`, color: threshold.color }}
          >
            {threshold.label}
          </span>
        </div>
      ) : (
        <div className="flex items-baseline gap-3 mb-1">
          <span className="text-5xl font-extrabold text-gray-200">—</span>
          <span className="text-xs text-gray-400">Aucune US In Progress → Done</span>
        </div>
      )}

      {/* Workflow schema */}
      <LeadTimeSchema />

      <p className="text-[10px] text-gray-400 mt-auto">
        85e percentile ≤ {p85Days}j · WIP : {data.wipCount} · {data.issueDetails.length} US
      </p>
    </div>
  );
};

export default LeadCycleTimeCard;
