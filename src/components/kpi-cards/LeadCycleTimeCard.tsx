import React, { useState } from 'react';
import type { SprintLeadCycleTimeResult } from '../../types/kpi.types';
import { getThresholdLevel, LEAD_TIME_THRESHOLDS } from '../../kpi/thresholds.config';
import USLeadTimeTable from './USLeadTimeTable';
import KPITooltip from './KPITooltip';

interface LeadCycleTimeCardProps {
  data: SprintLeadCycleTimeResult | null;
  isLoading: boolean;
  error: string | null;
  jiraBaseUrl?: string;
}

const BUSINESS_HOURS_PER_DAY = 9;

const LeadCycleTimeCard: React.FC<LeadCycleTimeCardProps> = ({ data, isLoading, error, jiraBaseUrl }) => {
  const [showDetails, setShowDetails] = useState(false);

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

  const hasMedian = data.leadTime.medianHours !== null;
  const medianDays = hasMedian ? data.leadTime.medianHours! / BUSINESS_HOURS_PER_DAY : null;
  const threshold = medianDays !== null ? getThresholdLevel(medianDays, LEAD_TIME_THRESHOLDS) : null;
  const p85Days = data.leadTime.p85Hours !== null
    ? (data.leadTime.p85Hours / BUSINESS_HOURS_PER_DAY).toFixed(1)
    : '—';

  // Averages in business hours + days
  const avgLeadHours = data.leadTime.averageHours !== null
    ? data.leadTime.averageHours.toFixed(1)
    : '—';
  const avgLeadDays = data.leadTime.averageHours !== null
    ? (data.leadTime.averageHours / BUSINESS_HOURS_PER_DAY).toFixed(1)
    : '—';
  const avgCycleDevHours = data.cycleDevTime.averageHours !== null
    ? data.cycleDevTime.averageHours.toFixed(1)
    : '—';
  const avgCycleDevDays = data.cycleDevTime.averageHours !== null
    ? (data.cycleDevTime.averageHours / BUSINESS_HOURS_PER_DAY).toFixed(1)
    : '—';

  // Breakdown: aggregate from issue details
  const totals = data.issueDetails.reduce(
    (acc, issue) => {
      acc.active += issue.activeTimeHours ?? 0;
      acc.review += issue.codeReviewTimeHours ?? 0;
      acc.wait += issue.waitTimeHours ?? 0;
      return acc;
    },
    { active: 0, review: 0, wait: 0 },
  );
  const breakdownTotal = totals.active + totals.review + totals.wait;

  const pct = (value: number) => {
    if (breakdownTotal === 0) return 0;
    return Math.round((value / breakdownTotal) * 100);
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm min-h-[220px] flex flex-col">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-1">
        <KPITooltip text={"Médiane du temps écoulé entre le statut Ready et Done.\nCalculé en jours ouvrés (lun-ven, 9h-18h).\n1 jour ouvré = 9 heures."}>
          ⏱ Lead Time
        </KPITooltip>
      </h3>
      <p className="text-xs text-gray-400 mb-3">Ready → Done (jours ouvrés)</p>

      {/* Main metric */}
      {medianDays !== null && threshold !== null ? (
        <div className="flex items-baseline gap-3 mb-4">
          <span className="text-5xl font-extrabold tabular-nums" style={{ color: threshold.color }}>
            {medianDays.toFixed(1)}j
          </span>
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: `${threshold.color}15`, color: threshold.color }}
          >
            {threshold.label}
          </span>
        </div>
      ) : (
        <div className="flex items-baseline gap-3 mb-4">
          <span className="text-5xl font-extrabold text-gray-200">—</span>
          <span className="text-xs text-gray-400">Aucune US Ready → Done</span>
        </div>
      )}

      {/* Avg Lead Time / Avg Cycle Dev Time */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl bg-gray-50 px-4 py-3">
          <p className="text-xs text-gray-400 mb-0.5">
            <KPITooltip text={"Moyenne du temps total entre le premier statut À faire/Ready et le statut Terminé/Done.\nInclut tout le temps d'attente, de développement et de revue.\nCalculé en jours ouvrés (lun-ven, 9h-18h).\n1 jour ouvré = 9 heures."}>
              Avg Lead Time
            </KPITooltip>
          </p>
          <p className="text-xl font-bold text-gray-700 tabular-nums">{avgLeadDays}j <span className="text-sm font-medium text-gray-400">({avgLeadHours}h ouvrées)</span></p>
          <p className="text-[10px] text-gray-400">À faire → Terminé</p>
        </div>
        <div className="rounded-xl bg-blue-50 px-4 py-3">
          <p className="text-xs text-gray-400 mb-0.5">
            <KPITooltip text={"Moyenne du temps entre le premier statut À faire/Ready et le début de la Revue de code.\nInclut le temps d'attente et de développement actif.\nExclut le temps de revue de code.\nCalculé en jours ouvrés (lun-ven, 9h-18h).\n1 jour ouvré = 9 heures."}>
              Avg Cycle Dev Time
            </KPITooltip>
          </p>
          <p className="text-xl font-bold text-blue-600 tabular-nums">{avgCycleDevDays}j <span className="text-sm font-medium text-blue-300">({avgCycleDevHours}h ouvrées)</span></p>
          <p className="text-[10px] text-gray-400">À faire → À valider</p>
        </div>
      </div>

      {/* Stacked bar */}
      {breakdownTotal > 0 && (
        <div className="mb-4">
          <div className="flex h-4 rounded-full overflow-hidden bg-gray-100">
            <div
              className="transition-all duration-700 ease-out"
              style={{ width: `${pct(totals.active)}%`, backgroundColor: '#3b82f6' }}
              title={`In Progress: ${pct(totals.active)}%`}
            />
            <div
              className="transition-all duration-700 ease-out"
              style={{ width: `${pct(totals.review)}%`, backgroundColor: '#a855f7' }}
              title={`In Review: ${pct(totals.review)}%`}
            />
            <div
              className="transition-all duration-700 ease-out"
              style={{ width: `${pct(totals.wait)}%`, backgroundColor: '#94a3b8' }}
              title={`Wait: ${pct(totals.wait)}%`}
            />
          </div>
          <div className="flex text-xs text-gray-400 mt-2 gap-4">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" />
              In Progress
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-purple-500" />
              In Review
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-400" />
              Attente
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mt-auto">
        <p className="text-sm text-gray-500">
          85% des US · Lead Time ≤ {p85Days}j · In Progress : {data.wipCount} · {data.issueDetails.length} US
        </p>
        {data.issueDetails.length > 0 && (
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold transition-colors"
          >
            {showDetails ? '▲ Masquer' : '▼ Détail par US'}
          </button>
        )}
      </div>

      {/* Expandable US detail table */}
      {showDetails && data.issueDetails.length > 0 && (
        <USLeadTimeTable
          issueDetails={data.issueDetails}
          jiraBaseUrl={jiraBaseUrl}
        />
      )}
    </div>
  );
};

export default LeadCycleTimeCard;
