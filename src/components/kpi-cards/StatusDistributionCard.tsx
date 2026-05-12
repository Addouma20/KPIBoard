import React, { useEffect, useState, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { StatusDistributionResult, StatusCount } from '../../types/kpi.types';
import KPITooltip from './KPITooltip';

interface StatusDistributionCardProps {
  sprintId?: number;
  projectKey?: string;
  startDate?: string;
  endDate?: string;
}

const CATEGORY_COLORS: Record<StatusCount['category'], string> = {
  done: '#22c55e',
  in_progress: '#3b82f6',
  review: '#a855f7',
  todo: '#9ca3af',
  blocked: '#ef4444',
  other: '#f59e0b',
};

const CATEGORY_LABELS: Record<StatusCount['category'], string> = {
  done: 'Done',
  in_progress: 'En cours',
  review: 'En revue',
  todo: 'À faire',
  blocked: 'Bloqué',
  other: 'Autre',
};

const StatusDistributionCard: React.FC<StatusDistributionCardProps> = ({
  sprintId,
  projectKey,
  startDate,
  endDate,
}) => {
  const [data, setData] = useState<StatusDistributionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let url: string;
      if (sprintId) {
        url = `/api/kpi/status-distribution?sprintId=${encodeURIComponent(sprintId)}`;
      } else if (projectKey && startDate && endDate) {
        const params = new URLSearchParams({ projectKey, startDate, endDate });
        url = `/api/kpi/status-distribution-kanban?${params}`;
      } else {
        return;
      }

      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? `Erreur HTTP ${res.status}`);
      }
      const json: StatusDistributionResult = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setIsLoading(false);
    }
  }, [sprintId, projectKey, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm animate-pulse min-h-[300px]">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-6" />
        <div className="h-48 bg-gray-100 rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm min-h-[300px]">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">📊 Statuts des US</h3>
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );
  }

  if (!data || data.totalUS === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm min-h-[300px]">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">📊 Statuts des US</h3>
        <p className="text-gray-400 text-sm">Aucune US trouvée.</p>
      </div>
    );
  }

  const chartData = data.statuses.map((s) => ({
    name: s.status,
    count: s.count,
    category: s.category,
    color: CATEGORY_COLORS[s.category],
  }));

  const { byCategoryCount } = data;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm min-h-[300px] flex flex-col">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-1">
        <KPITooltip text={"Répartition des US par statut Jira.\n\nChaque barre représente un statut distinct.\nLes couleurs indiquent la catégorie :\n• Vert = Done\n• Bleu = En cours\n• Violet = En revue\n• Gris = À faire\n• Rouge = Bloqué\n• Orange = Autre"}>
          📊 Distribution des statuts
        </KPITooltip>
      </h3>
      <p className="text-xs text-gray-400 mb-3">{data.totalUS} US Dev au total</p>

      {/* KPI metrics derived from actual distribution */}
      <div className="flex flex-wrap gap-3 mb-4">
        {(() => {
          const doneCount = data.byCategoryCount.done;
          const inProgressCount = data.byCategoryCount.in_progress + data.byCategoryCount.review;
          const todoCount = data.byCategoryCount.todo;
          const blockedCount = data.byCategoryCount.blocked;
          const completionPct = data.totalUS > 0 ? Math.round((doneCount / data.totalUS) * 100) : 0;
          const inProgressPct = data.totalUS > 0 ? Math.round((inProgressCount / data.totalUS) * 100) : 0;
          return (
            <>
              <div className="flex flex-col items-center rounded-xl bg-green-50 px-4 py-2 min-w-[80px]">
                <span className="text-lg font-extrabold text-green-600">{completionPct}%</span>
                <span className="text-[10px] text-green-500 font-medium">Réalisé</span>
                <span className="text-[9px] text-gray-400">{doneCount} US</span>
              </div>
              <div className="flex flex-col items-center rounded-xl bg-blue-50 px-4 py-2 min-w-[80px]">
                <span className="text-lg font-extrabold text-blue-600">{inProgressPct}%</span>
                <span className="text-[10px] text-blue-500 font-medium">En cours</span>
                <span className="text-[9px] text-gray-400">{inProgressCount} US</span>
              </div>
              {todoCount > 0 && (
                <div className="flex flex-col items-center rounded-xl bg-gray-50 px-4 py-2 min-w-[80px]">
                  <span className="text-lg font-extrabold text-gray-500">{Math.round((todoCount / data.totalUS) * 100)}%</span>
                  <span className="text-[10px] text-gray-400 font-medium">À faire</span>
                  <span className="text-[9px] text-gray-400">{todoCount} US</span>
                </div>
              )}
              {blockedCount > 0 && (
                <div className="flex flex-col items-center rounded-xl bg-red-50 px-4 py-2 min-w-[80px]">
                  <span className="text-lg font-extrabold text-red-500">{Math.round((blockedCount / data.totalUS) * 100)}%</span>
                  <span className="text-[10px] text-red-400 font-medium">Bloqué</span>
                  <span className="text-[9px] text-gray-400">{blockedCount} US</span>
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Category summary pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(Object.entries(byCategoryCount) as Array<[StatusCount['category'], number]>)
          .filter(([, count]) => count > 0)
          .map(([cat, count]) => (
            <span
              key={cat}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ backgroundColor: `${CATEGORY_COLORS[cat]}15`, color: CATEGORY_COLORS[cat] }}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: CATEGORY_COLORS[cat] }}
              />
              {CATEGORY_LABELS[cat]} : {count}
            </span>
          ))}
      </div>

      {/* Bar chart */}
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={false}
              angle={-25}
              textAnchor="end"
              height={60}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              width={30}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                fontSize: '12px',
              }}
              formatter={(value) => [`${value} US`]}
            />
            <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={40}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default StatusDistributionCard;
