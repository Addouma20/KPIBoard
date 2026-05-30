import React, { useEffect, useState } from 'react';
import type { ROIMetrics } from '../../types/kpi.types';
import KPITooltip from './KPITooltip';

interface ROICardProps {
  projectKey: string;
  startDate: string;
  endDate: string;
}

const ROICard: React.FC<ROICardProps> = ({ projectKey, startDate, endDate }) => {
  const [data, setData] = useState<ROIMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/kpi/roi?projectKey=${encodeURIComponent(projectKey)}&startDate=${startDate}&endDate=${endDate}`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur inconnue');
      } finally {
        setIsLoading(false);
      }
    };
    if (projectKey && startDate && endDate) fetchData();
  }, [projectKey, startDate, endDate]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm animate-pulse min-h-[200px]">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-6" />
        <div className="h-20 bg-gray-200 rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">📊 ROI IA</h3>
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
        <KPITooltip text={"ROI Agent IA\n\n• Adoption IA = US assistées IA / Total US × 100\n• Jours économisés = (Cycle Dev humain − Cycle Dev IA) × Nb US IA / 9h\n• Réduction Cycle Dev = (CycleDev_humain − CycleDev_IA) / CycleDev_humain × 100\n• FTR IA = % MR IA approuvées sans retour au 1er passage"}>
          📊 ROI — Agent IA
        </KPITooltip>
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="text-center">
          <p className="text-3xl font-extrabold text-purple-600">{data.iaAdoptionPercent}%</p>
          <p className="text-xs text-gray-400 mt-1">Adoption IA</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-extrabold text-blue-600">{data.iaUS}</p>
          <p className="text-xs text-gray-400 mt-1">US assistées IA</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-extrabold text-green-600">
            {data.estimatedDaysSaved !== null ? `${data.estimatedDaysSaved}j` : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-1">Jours économisés</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-extrabold text-green-600">
            {data.avgCycleDevReductionPercent !== null ? `${data.avgCycleDevReductionPercent}%` : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-1">Réduction Cycle Dev</p>
        </div>
      </div>

      <div className="flex gap-4 text-sm text-gray-500 border-t border-gray-50 pt-3">
        <span>
          FTR IA : <strong className="text-purple-600">{data.iaFirstTimeRightPercent ?? '—'}%</strong>
        </span>
        <span>
          FTR Manuel : <strong>{data.nonIAFirstTimeRightPercent ?? '—'}%</strong>
        </span>
        <span>
          Lead Time Δ : <strong className={data.avgLeadTimeReductionPercent !== null && data.avgLeadTimeReductionPercent > 0 ? 'text-green-600' : ''}>
            {data.avgLeadTimeReductionPercent !== null ? `${data.avgLeadTimeReductionPercent > 0 ? '-' : '+'}${Math.abs(data.avgLeadTimeReductionPercent)}%` : '—'}
          </strong>
        </span>
      </div>
    </div>
  );
};

export default ROICard;
