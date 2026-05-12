import React, { useEffect, useState, useCallback } from 'react';
import type { StatusCount } from '../types';
import type { WorkflowKPIValues } from './kpi-cards/WorkflowStatusCard';

const WorkflowStatusCard = React.lazy(() => import('./kpi-cards/WorkflowStatusCard'));
const KPIDevCards = React.lazy(() => import('./kpi-cards/KPIDevCards'));

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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [boardStatuses, setBoardStatuses] = useState<StatusCount[]>([]);
  const [kpiValues, setKpiValues] = useState<WorkflowKPIValues | undefined>(undefined);

  const fetchStatuses = useCallback(async () => {
    if (!startDate || !endDate) return;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ projectKey, startDate, endDate });
      const res = await fetch(`/api/kpi/status-distribution-kanban?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? `Erreur HTTP ${res.status}`);
      }
      const json = await res.json();
      setBoardStatuses(json.statuses ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setIsLoading(false);
    }
  }, [projectKey, startDate, endDate]);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erreur lors du chargement des KPIs : {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Workflow du Projet — statuts réels Jira, sans regroupement */}
      {boardStatuses.length > 0 && (
        <React.Suspense fallback={null}>
          <WorkflowStatusCard statuses={boardStatuses} kpiValues={kpiValues} />
        </React.Suspense>
      )}

      {/* Synthèse KPIs Dev IA vs Dev Humain */}
      {boardStatuses.length > 0 && (
        <React.Suspense fallback={<CardFallback />}>
          <KPIDevCards
            projectKey={projectKey}
            startDate={startDate}
            endDate={endDate}
            statuses={boardStatuses}
            onKPIValues={setKpiValues}
          />
        </React.Suspense>
      )}
    </div>
  );
};

export default KanbanKPIGrid;
