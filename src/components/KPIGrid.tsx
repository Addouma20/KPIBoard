import React, { useEffect, useState, useCallback } from 'react';
import type { StatusCount } from '../types';
import type { WorkflowKPIValues } from './kpi-cards/WorkflowStatusCard';

const WorkflowStatusCard = React.lazy(() => import('./kpi-cards/WorkflowStatusCard'));
const CycleDevReviewTrendCard = React.lazy(() => import('./kpi-cards/CycleDevReviewTrendCard'));
const KPIDevCards = React.lazy(() => import('./kpi-cards/KPIDevCards'));

interface KPIGridProps {
  sprintId: number;
  boardId: number | null;
  projectKey: string;
  startDate: string;
  endDate: string;
}

const CardFallback: React.FC = () => (
  <div className="flex h-56 items-center justify-center rounded-xl border border-gray-200 bg-white shadow-card">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" aria-hidden="true" />
  </div>
);

const KPIGrid: React.FC<KPIGridProps> = ({ sprintId, boardId, projectKey, startDate, endDate }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [boardStatuses, setBoardStatuses] = useState<StatusCount[]>([]);
  const [kpiValues, setKpiValues] = useState<WorkflowKPIValues | undefined>(undefined);

  const fetchStatuses = useCallback(async (id: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/kpi/status-distribution?sprintId=${encodeURIComponent(id)}`);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? `Erreur HTTP ${response.status}`);
      }
      const json = await response.json();
      setBoardStatuses(json.statuses ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatuses(sprintId);
  }, [sprintId, fetchStatuses]);

  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-error-500/30 bg-error-100 p-4 text-sm text-error-500 font-medium">
        Erreur lors du chargement des KPIs : {error}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-56 items-center justify-center rounded-xl border border-gray-200 bg-white shadow-card" role="status" aria-label="Chargement">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Workflow du Projet — statuts réels Jira */}
      {boardStatuses.length > 0 && (
        <React.Suspense fallback={null}>
          <WorkflowStatusCard statuses={boardStatuses} kpiValues={kpiValues} />
        </React.Suspense>
      )}

      {/* Évolution Cycle Dev Time & Σ Reviews — 5 derniers sprints */}
      {boardId && (
        <React.Suspense fallback={<CardFallback />}>
          <CycleDevReviewTrendCard boardId={boardId} />
        </React.Suspense>
      )}

      {/* Synthèse KPIs par profil */}
      {boardStatuses.length > 0 && (
        <React.Suspense fallback={<CardFallback />}>
          <KPIDevCards
            projectKey={projectKey}
            startDate={startDate}
            endDate={endDate}
            sprintId={sprintId}
            statuses={boardStatuses}
            onKPIValues={setKpiValues}
          />
        </React.Suspense>
      )}
    </div>
  );
};

export default KPIGrid;
