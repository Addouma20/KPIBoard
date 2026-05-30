/**
 * CycleDevReviewTrendCard
 *
 * Évolution sur les 5 derniers sprints de :
 *  • Cycle Dev Time moyen (courbe bleue, axe gauche, en jours ouvrés)
 *  • Σ allers-retours review US (courbe rouge, axe droit, nb total)
 */
import React, { useEffect, useState } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrendPoint {
  sprintId: number;
  sprintName: string;
  avgCycleDevTimeHours: number | null;
  totalReworkCount: number | null;
}

interface CycleDevReviewTrendCardProps {
  boardId: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BUSINESS_HOURS_PER_DAY = 9;

function shortName(name: string): string {
  const match = name.match(/Sprint\s*\d+(?:\.\d+)?/i);
  return match ? match[0] : name.slice(-12);
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

interface TooltipPayload {
  name: string;
  value: number | null;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      background: '#fff',
      padding: '10px 14px',
      fontSize: '12px',
    }}>
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name} :{' '}
          <strong>
            {entry.value === null ? '—' : entry.name.includes('(j)') ? `${entry.value}j` : entry.value}
          </strong>
        </p>
      ))}
    </div>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────

const CycleDevReviewTrendCard: React.FC<CycleDevReviewTrendCardProps> = ({ boardId }) => {
  const [data, setData] = useState<TrendPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!boardId) return;

    let cancelled = false;
    const fetchTrend = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/kpi/trend?boardId=${encodeURIComponent(boardId)}&last=5`);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error?.message ?? `Erreur HTTP ${res.status}`);
        }
        const json: TrendPoint[] = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchTrend();
    return () => { cancelled = true; };
  }, [boardId]);

  if (!boardId) return null;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-card animate-pulse min-h-[280px]">
        <div className="h-4 bg-gray-200 rounded w-2/5 mb-4" />
        <div className="h-52 bg-gray-100 rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-card min-h-[280px]">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">📉 Évolution Cycle Dev & Reviews</h3>
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-card min-h-[280px]">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">📉 Évolution Cycle Dev & Reviews</h3>
        <p className="text-gray-400 text-sm italic">Aucune donnée disponible.</p>
      </div>
    );
  }

  const chartData = data.map((p) => ({
    name: shortName(p.sprintName),
    'Cycle Dev Time (j)': p.avgCycleDevTimeHours !== null
      ? Math.round((p.avgCycleDevTimeHours / BUSINESS_HOURS_PER_DAY) * 10) / 10
      : null,
    'Σ Reviews US': p.totalReworkCount ?? null,
  }));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-base font-semibold text-gray-800">📉 Évolution Cycle Dev &amp; Reviews</span>
        <span className="text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5">
          5 derniers sprints
        </span>
      </div>
      <p className="text-[11px] text-gray-400 mb-4">
        <span className="inline-flex items-center gap-1 mr-3">
          <span className="inline-block w-3 h-0.5 bg-blue-500 rounded" />
          Cycle Dev Time moy. (jours ouvrés)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-red-500 rounded" />
          Σ allers-retours review par sprint
        </span>
      </p>

      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={false}
            />
            {/* Left axis: Cycle Dev Time in days */}
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: '#3b82f6' }}
              axisLine={false}
              tickLine={false}
              width={36}
              label={{ value: 'j', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 10, fill: '#3b82f6' } }}
            />
            {/* Right axis: total rework / review count */}
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fill: '#ef4444' }}
              axisLine={false}
              tickLine={false}
              width={36}
              allowDecimals={false}
              label={{ value: 'nb', angle: 90, position: 'insideRight', offset: 10, style: { fontSize: 10, fill: '#ef4444' } }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="Cycle Dev Time (j)"
              stroke="#3b82f6"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#3b82f6' }}
              activeDot={{ r: 6 }}
              connectNulls
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="Σ Reviews US"
              stroke="#ef4444"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#ef4444' }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default CycleDevReviewTrendCard;
