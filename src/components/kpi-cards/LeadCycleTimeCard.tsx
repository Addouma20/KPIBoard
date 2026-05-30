import React from 'react';
import type { SprintLeadCycleTimeResult } from '../../types/kpi.types';
import { getThresholdLevel, LEAD_TIME_THRESHOLDS } from '../../kpi/thresholds.config';
import KPITooltip from './KPITooltip';

/** Workflow schema showing Lead Time and Cycle Time / Ticket-to-Merge brackets */
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
        <KPITooltip text={"KPI 4 — Lead Time (Ticket to Merge)\n\nFormule : Date 1er \"In Progress\" → Date \"Done\" en jours ouvrés\n1 jour ouvré = 9h (lun-ven, 9h-18h, Europe/Paris)\n\nMédiane affichée (résistante aux valeurs extrêmes).\n85e percentile = durée des cas les plus lents.\n\nDifférence avec les autres mesures :\n• Lead Time complet = Ready → Done (inclut l'attente backlog)\n• Cycle Time = Σ(In Progress + In Review) uniquement\n• Temps revue = In Review → Done"}>
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

      <p className="text-[10px] text-gray-400 mt-auto">
        85e percentile ≤ {p85Days}j · WIP : {data.wipCount} · {data.issueDetails.length} US
      </p>
    </div>
  );
};

export default LeadCycleTimeCard;
