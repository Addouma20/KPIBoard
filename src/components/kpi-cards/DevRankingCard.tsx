import React, { useEffect, useState } from 'react';
import type { SprintDevRankingResult, DevStats } from '../../types/kpi.types';
import KPITooltip from './KPITooltip';

interface DevRankingCardProps {
  // Sprint mode
  sprintId?: number;
  // Kanban mode
  projectKey?: string;
  startDate?: string;
  endDate?: string;
}

const BUSINESS_HOURS_PER_DAY = 9;

const MEDAL = ['🥇', '🥈', '🥉'] as const;

function formatHours(hours: number | null): string {
  if (hours === null) return '—';
  const days = hours / BUSINESS_HOURS_PER_DAY;
  return `${days.toFixed(1)}j`;
}

function scoreColor(score: number): string {
  if (score >= 70) return '#22c55e';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

function scoreBg(score: number): string {
  if (score >= 70) return 'bg-green-50';
  if (score >= 50) return 'bg-amber-50';
  return 'bg-red-50';
}

const DevRow: React.FC<{ dev: DevStats; rank: number }> = ({ dev, rank }) => {
  const medal = rank < 3 ? MEDAL[rank] : null;

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-3 py-2.5 text-center">
        {medal ? (
          <span className="text-lg">{medal}</span>
        ) : (
          <span className="text-xs font-medium text-gray-400">{rank + 1}</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <span className="font-medium text-gray-800">{dev.displayName}</span>
        <span className="ml-2 text-xs text-gray-400">
          {dev.usDone}/{dev.usCount} US
          {dev.totalStoryPoints !== null && ` · ${dev.totalStoryPoints} SP`}
        </span>
      </td>
      <td className="px-3 py-2.5 text-right text-sm tabular-nums text-gray-600">
        {formatHours(dev.avgLeadTimeHours)}
      </td>
      <td className="px-3 py-2.5 text-right text-sm tabular-nums text-blue-600">
        {formatHours(dev.avgCycleDevTimeHours)}
      </td>
      <td className="px-3 py-2.5 text-right text-sm tabular-nums text-gray-600">
        {dev.avgMRIterations !== null ? dev.avgMRIterations.toFixed(1) : '—'}
      </td>
      <td className="px-3 py-2.5 text-right text-sm tabular-nums">
        <span className={dev.totalBugs > 0 ? 'text-red-500 font-medium' : 'text-gray-400'}>
          {dev.totalBugs}
        </span>
        {dev.bugsPerUS !== null && (
          <span className="text-[10px] text-gray-400 ml-1">({dev.bugsPerUS}/US)</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-center">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${scoreBg(dev.score)}`}
          style={{ color: scoreColor(dev.score) }}
        >
          {dev.score}
        </span>
      </td>
    </tr>
  );
};

const DevRankingCard: React.FC<DevRankingCardProps> = ({ sprintId, projectKey, startDate, endDate }) => {
  const [data, setData] = useState<SprintDevRankingResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isKanban = !sprintId && !!projectKey && !!startDate && !!endDate;

  useEffect(() => {
    let cancelled = false;

    const fetchRanking = async () => {
      setIsLoading(true);
      setError(null);
      try {
        let url: string;
        if (isKanban) {
          const params = new URLSearchParams({ projectKey: projectKey!, startDate: startDate!, endDate: endDate! });
          url = `/api/kpi/dev-ranking-kanban?${params}`;
        } else {
          url = `/api/kpi/dev-ranking?sprintId=${encodeURIComponent(sprintId!)}`;
        }
        const res = await fetch(url);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error?.message ?? `Erreur HTTP ${res.status}`);
        }
        const json: SprintDevRankingResult = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchRanking();
    return () => { cancelled = true; };
  }, [sprintId, projectKey, startDate, endDate, isKanban]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm animate-pulse min-h-[280px]">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-6" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm min-h-[280px]">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">🏆 Équipe de Réalisation</h3>
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );
  }

  if (!data || data.developers.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm min-h-[280px]">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">🏆 Équipe de Réalisation</h3>
        <p className="text-gray-400 text-sm">Aucune donnée disponible.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm min-h-[280px] flex flex-col">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-1">
        <KPITooltip text={"Équipe de Réalisation — score composite par développeur :\n\n• Lead Time (25%) — rapidité de livraison\n• Cycle Dev (20%) — temps de dév actif\n• Itérations MR (20%) — qualité du code soumis\n• Bugs/US (20%) — fiabilité\n• Complétion (15%) — US terminées\n\nScore de 0 à 100. Plus le score est élevé, meilleure est la performance globale."}>
          🏆 Équipe de Réalisation
        </KPITooltip>
      </h3>
      <p className="text-xs text-gray-400 mb-4">Performance par développeur sur {isKanban ? 'la période' : 'le sprint'}</p>

      <div className="overflow-x-auto -mx-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              <th className="px-3 py-2 text-center w-12">#</th>
              <th className="px-3 py-2">Développeur</th>
              <th className="px-3 py-2 text-right">Lead Time</th>
              <th className="px-3 py-2 text-right">Cycle Dev</th>
              <th className="px-3 py-2 text-right">MR Iter.</th>
              <th className="px-3 py-2 text-right">Bugs</th>
              <th className="px-3 py-2 text-center">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.developers.map((dev, i) => (
              <DevRow key={dev.displayName} dev={dev} rank={i} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-[10px] text-gray-400">
        Score = Lead Time (25%) + Cycle Dev (20%) + Itérations MR (20%) + Bugs/US (20%) + Complétion (15%)
      </div>
    </div>
  );
};

export default DevRankingCard;
