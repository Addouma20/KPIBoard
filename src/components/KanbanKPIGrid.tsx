import React, { useEffect, useState, useCallback } from 'react';
import type {
  USCompletionRateResult,
  SprintMRIterationsResult,
  SprintLeadCycleTimeResult,
  SprintBugsResult,
} from '../types';

const CompletionRateCard = React.lazy(() => import('./kpi-cards/CompletionRateCard'));
const MRIterationsCard = React.lazy(() => import('./kpi-cards/MRIterationsCard'));
const LeadCycleTimeCard = React.lazy(() => import('./kpi-cards/LeadCycleTimeCard'));
const BugsPerUSCard = React.lazy(() => import('./kpi-cards/BugsPerUSCard'));
const DevRankingCard = React.lazy(() => import('./kpi-cards/DevRankingCard'));
const StatusDistributionCard = React.lazy(() => import('./kpi-cards/StatusDistributionCard'));
const KanbanTrendCard = React.lazy(() => import('./kpi-cards/KanbanTrendCard'));

interface KanbanAllKPIResponse {
  periodLabel: string;
  startDate: string;
  endDate: string;
  exportDate: string;
  completionRate: USCompletionRateResult | null;
  mrIterations: SprintMRIterationsResult | null;
  leadCycleTime: SprintLeadCycleTimeResult | null;
  bugs: SprintBugsResult | null;
  errors: Array<{ kpi: string; error: { code: string; message: string } }>;
}

interface KanbanKPIGridProps {
  projectKey: string;
  startDate: string;
  endDate: string;
}

const CardFallback: React.FC = () => (
  <div className="flex h-56 items-center justify-center rounded-2xl border border-gray-100 bg-white shadow-sm">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
  </div>
);

const KanbanKPIGrid: React.FC<KanbanKPIGridProps> = ({ projectKey, startDate, endDate }) => {
  const [data, setData] = useState<KanbanAllKPIResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchKPIs = useCallback(async () => {
    if (!startDate || !endDate) return;

    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ projectKey, startDate, endDate });
      const response = await fetch(`/api/kpi/all-kanban?${params}`);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? `Erreur HTTP ${response.status}`);
      }
      const json: KanbanAllKPIResponse = await response.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setIsLoading(false);
    }
  }, [projectKey, startDate, endDate]);

  useEffect(() => {
    fetchKPIs();
  }, [fetchKPIs]);

  const kpiError = (kpiName: string): string | undefined => {
    const found = data?.errors.find((e) => e.kpi === kpiName);
    return found ? found.error.message : undefined;
  };

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erreur lors du chargement des KPIs : {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period info */}
      {data && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Période analysée : <span className="font-medium">{data.periodLabel}</span>
        </div>
      )}

      {/* Row 1: Completion Rate + MR Iterations */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <React.Suspense fallback={<CardFallback />}>
          <CompletionRateCard
            data={data?.completionRate ?? null}
            isLoading={isLoading}
            error={data?.completionRate === null ? kpiError('completion-rate') ?? null : null}
          />
        </React.Suspense>
        <React.Suspense fallback={<CardFallback />}>
          <MRIterationsCard
            data={data?.mrIterations ?? null}
            isLoading={isLoading}
            error={data?.mrIterations === null ? kpiError('mr-iterations') ?? null : null}
          />
        </React.Suspense>
      </div>

      {/* Row 2: Lead Time + Bugs */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <React.Suspense fallback={<CardFallback />}>
          <LeadCycleTimeCard
            data={data?.leadCycleTime ?? null}
            isLoading={isLoading}
            error={data?.leadCycleTime === null ? kpiError('lead-cycle-time') ?? null : null}
          />
        </React.Suspense>
        <React.Suspense fallback={<CardFallback />}>
          <BugsPerUSCard
            data={data?.bugs ?? null}
            isLoading={isLoading}
            error={data?.bugs === null ? kpiError('bugs') ?? null : null}
          />
        </React.Suspense>
      </div>

      {/* Row 3: Status Distribution */}
      <React.Suspense fallback={<CardFallback />}>
        <StatusDistributionCard
          projectKey={projectKey}
          startDate={startDate}
          endDate={endDate}
        />
      </React.Suspense>

      {/* Row 4: Dev Ranking (Kanban mode) */}
      <React.Suspense fallback={<CardFallback />}>
        <DevRankingCard
          projectKey={projectKey}
          startDate={startDate}
          endDate={endDate}
        />
      </React.Suspense>

      {/* Row 5: Kanban Trend (6 derniers mois) */}
      <React.Suspense fallback={<CardFallback />}>
        <KanbanTrendCard projectKey={projectKey} />
      </React.Suspense>
    </div>
  );
};

export default KanbanKPIGrid;
