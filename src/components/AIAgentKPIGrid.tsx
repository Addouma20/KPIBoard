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
  <div className="flex h-56 items-center justify-center rounded-2xl border border-gray-100 bg-white shadow-sm">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
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
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erreur lors du chargement des KPIs Agent IA : {error}
      </div>
    );
  }

  const issueCount = data?.completionRate?.totalUS ?? null;

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex items-center gap-3 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-800">
        <span className="text-xl">🤖</span>
        <div>
          <span className="font-semibold">US travaillées par l'agent IA</span>
          {data && (
            <span className="ml-2 text-purple-600">
              — {issueCount !== null ? `${issueCount} US détectées` : 'Analyse en cours…'}
              {' · '}
              <span className="italic">{data.periodLabel}</span>
            </span>
          )}
          {isLoading && <span className="ml-2 italic text-purple-400">Chargement…</span>}
        </div>
      </div>

      {/* Empty state */}
      {!isLoading && data && issueCount === 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          Aucune US avec des marqueurs IA détectés dans les commentaires (ex: "agent IA", "dev IA", "Merge Request", "copilot", "ChatGPT", "généré automatiquement"…) trouvée sur cette période.
        </div>
      )}

      {/* KPI cards (same layout as main view) */}
      {(isLoading || (data && issueCount !== 0)) && (
        <>
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
        </>
      )}
    </div>
  );
};

export default AIAgentKPIGrid;
