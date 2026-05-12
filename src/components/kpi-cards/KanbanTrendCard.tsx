import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { KanbanTrendPoint } from '../../types/kpi.types';
import KPITooltip from './KPITooltip';

interface KanbanTrendCardProps {
  projectKey: string;
}

const COLORS = {
  completionRate: '#22c55e',
  avgMRIterations: '#f59e0b',
  avgLeadTimeHours: '#f59e0b',
  avgCycleDevTimeHours: '#3b82f6',
  bugsPerUSRatio: '#ef4444',
} as const;

const BUSINESS_HOURS_PER_DAY = 9;

const KanbanTrendCard: React.FC<KanbanTrendCardProps> = ({ projectKey }) => {
  const [data, setData] = useState<KanbanTrendPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectKey) return;

    let cancelled = false;
    const fetchTrend = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ projectKey, months: '6' });
        const res = await fetch(`/api/kpi/trend-kanban?${params}`);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error?.message ?? `Erreur HTTP ${res.status}`);
        }
        const json: KanbanTrendPoint[] = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchTrend();
    return () => { cancelled = true; };
  }, [projectKey]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm animate-pulse min-h-[320px]">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-6" />
        <div className="h-56 bg-gray-100 rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm min-h-[320px]">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">📈 Tendances</h3>
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm min-h-[320px]">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">📈 Tendances</h3>
        <p className="text-gray-400 text-sm">Aucune donnée disponible.</p>
      </div>
    );
  }

  const chartData = data.map((p) => ({
    name: p.monthLabel,
    'Lead Time (j)': p.avgLeadTimeHours !== null ? Math.round((p.avgLeadTimeHours / BUSINESS_HOURS_PER_DAY) * 10) / 10 : null,
    'Cycle Dev (j)': p.avgCycleDevTimeHours !== null ? Math.round((p.avgCycleDevTimeHours / BUSINESS_HOURS_PER_DAY) * 10) / 10 : null,
  }));

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm min-h-[320px] flex flex-col">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-1">
        <KPITooltip text={"Évolution des temps sur les 6 derniers mois.\n\nChaque point représente un mois complet.\n• Lead Time (j) — délai de livraison (À faire → Done)\n• Cycle Dev (j) — temps de dév actif (Dernier In Progress → 1er commentaire IA/MR)\n\nTous les temps sont en jours ouvrés."}>
          📈 Tendances KPI
        </KPITooltip>
      </h3>
      <p className="text-xs text-gray-400 mb-4">Évolution mensuelle sur les 6 derniers mois</p>

      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                fontSize: '12px',
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
            />
            <Line type="monotone" dataKey="Lead Time (j)" stroke={COLORS.avgLeadTimeHours} strokeWidth={2} dot={{ r: 4 }} connectNulls />
            <Line type="monotone" dataKey="Cycle Dev (j)" stroke={COLORS.avgCycleDevTimeHours} strokeWidth={2} dot={{ r: 4 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default KanbanTrendCard;
