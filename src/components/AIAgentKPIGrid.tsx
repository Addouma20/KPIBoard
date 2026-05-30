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

interface AIAgentKPIResponse {
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

// Props: either sprint mode or kanban mode
type AIAgentKPIGridProps =
  | { mode: 'scrum'; sprintId: number }
  | { mode: 'kanban'; projectKey: string; startDate: string; endDate: string };

const CardFallback: React.FC = () => (
  <div className="flex h-56 items-center justify-center rounded-xl border border-gray-200 bg-white shadow-card">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" aria-hidden="true" />
  </div>
);

const AIAgentKPIGrid: React.FC<AIAgentKPIGridProps> = (props) => {
  const [data, setData] = useState<AIAgentKPIResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildUrl = useCallback((): string => {
    if (props.mode === 'scrum') {
      return `/api/kpi/ai-agent?sprintId=${encodeURIComponent(props.sprintId)}`;
    }
    const p = new URLSearchParams({
      projectKey: props.projectKey,
      startDate: props.startDate,
      endDate: props.endDate,
    });
    return `/api/kpi/ai-agent?${p}`;
  }, [props]);

  const fetchKPIs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(buildUrl());
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? `Erreur HTTP ${response.status}`);
      }
      const json: AIAgentKPIResponse = await response.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setIsLoading(false);
    }
  }, [buildUrl]);

  useEffect(() => {
    fetchKPIs();
  }, [fetchKPIs]);

  const kpiError = (kpiName: string): string | undefined =>
    data?.errors.find((e) => e.kpi === kpiName)?.error.message;

  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-error-500/30 bg-error-100 p-4 text-sm text-error-500 font-medium">
        Erreur lors du chargement des KPIs Agent IA : {error}
      </div>
    );
  }

  const issueCount = data?.completionRate?.totalUS ?? null;

  return (
    <div className="space-y-6">
      {/* Empty state */}
      {!isLoading && data && issueCount === 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          Aucune US avec des marqueurs IA détectés dans les commentaires (ex: "agent IA", "dev IA", "Merge Request", "copilot", "ChatGPT", "généré automatiquement"…) trouvée sur cette période.
        </div>
      )}

      {/* KPI cards (same layout as main view) */}
      {(isLoading || (data && issueCount !== 0)) && (
        <>
          {/* Card 1: Completion Rate */}
          <React.Suspense fallback={<CardFallback />}>
            <CompletionRateCard
              data={data?.completionRate ?? null}
              isLoading={isLoading}
              error={data?.completionRate === null ? kpiError('completion-rate') ?? null : null}
            />
          </React.Suspense>

          {/* Card 2: MR Iterations */}
          <React.Suspense fallback={<CardFallback />}>
            <MRIterationsCard
              data={data?.mrIterations ?? null}
              isLoading={isLoading}
              error={data?.mrIterations === null ? kpiError('mr-iterations') ?? null : null}
            />
          </React.Suspense>

          {/* Card 3: Lead Time */}
          <React.Suspense fallback={<CardFallback />}>
            <LeadCycleTimeCard
              data={data?.leadCycleTime ?? null}
              isLoading={isLoading}
              error={data?.leadCycleTime === null ? kpiError('lead-cycle-time') ?? null : null}
            />
          </React.Suspense>

          {/* Card 4: Bugs */}
          <React.Suspense fallback={<CardFallback />}>
            <BugsPerUSCard
              data={data?.bugs ?? null}
              isLoading={isLoading}
              error={data?.bugs === null ? kpiError('bugs') ?? null : null}
            />
          </React.Suspense>
        </>
      )}
    </div>
  );
};

export default AIAgentKPIGrid;
