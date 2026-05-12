import React, { useEffect, useState } from 'react';
import type { IAComparisonResult } from '../../types/kpi.types';
import KPITooltip from './KPITooltip';

interface IAComparisonCardProps {
  projectKey: string;
  startDate: string;
  endDate: string;
}

function formatHours(h: number | null): string {
  if (h === null) return '—';
  if (h < 24) return `${Math.round(h)}h`;
  return `${Math.round(h / 9 * 10) / 10}j`;
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="text-gray-300 text-xs">—</span>;
  const isPositive = delta > 0;
  const color = isPositive ? '#ef4444' : '#22c55e';
  const sign = isPositive ? '+' : '';
  return (
    <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${color}15`, color }}>
      {sign}{delta}%
    </span>
  );
}

function MetricRow({ label, ia, nonIA, delta, tooltip }: {
  label: string;
  ia: string;
  nonIA: string;
  delta: number | null;
  tooltip: string;
}) {
  return (
    <tr className="border-b border-gray-50 last:border-0">
      <td className="py-2 text-sm text-gray-600">
        <KPITooltip text={tooltip}>{label}</KPITooltip>
      </td>
      <td className="py-2 text-sm font-semibold text-center text-purple-600">{ia}</td>
      <td className="py-2 text-sm font-semibold text-center text-gray-600">{nonIA}</td>
      <td className="py-2 text-center"><DeltaBadge delta={delta} /></td>
    </tr>
  );
}

const IAComparisonCard: React.FC<IAComparisonCardProps> = ({ projectKey, startDate, endDate }) => {
  const [data, setData] = useState<IAComparisonResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/kpi/ia-comparison?projectKey=${encodeURIComponent(projectKey)}&startDate=${startDate}&endDate=${endDate}`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json);
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
      <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm animate-pulse min-h-[300px]">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-6" />
        <div className="h-40 bg-gray-200 rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">🤖 IA vs Non-IA</h3>
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-1">
        <KPITooltip text="Comparaison des KPIs entre les US assistées par IA et les US manuelles.\nUn delta négatif (vert) signifie que l'IA est plus performante.">
          🤖 IA vs Non-IA — Comparaison
        </KPITooltip>
      </h3>
      <p className="text-xs text-gray-400 mb-4">
        {data.ia.totalUS} US Dev IA · {data.nonIA.totalUS} US Dev manuelles · Confiance : {data.dataQuality.confidence}
      </p>

      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left text-xs font-medium text-gray-400 pb-2">Métrique</th>
            <th className="text-center text-xs font-medium text-purple-400 pb-2">🤖 IA</th>
            <th className="text-center text-xs font-medium text-gray-400 pb-2">Manuel</th>
            <th className="text-center text-xs font-medium text-gray-400 pb-2">Δ</th>
          </tr>
        </thead>
        <tbody>
          <MetricRow
            label="Lead Time"
            ia={formatHours(data.ia.avgLeadTimeHours)}
            nonIA={formatHours(data.nonIA.avgLeadTimeHours)}
            delta={data.deltas.leadTimeDeltaPercent}
            tooltip="Temps total de la prise en charge à la livraison."
          />
          <MetricRow
            label="Cycle Dev"
            ia={formatHours(data.ia.avgCycleDevTimeHours)}
            nonIA={formatHours(data.nonIA.avgCycleDevTimeHours)}
            delta={data.deltas.cycleDevTimeDeltaPercent}
            tooltip="Temps de développement pur : dernier 'In Progress' → premier commentaire IA/MR (jours ouvrés)."
          />
          <MetricRow
            label="Pickup Time"
            ia={formatHours(data.ia.avgPickupTimeHours)}
            nonIA={formatHours(data.nonIA.avgPickupTimeHours)}
            delta={data.deltas.pickupTimeDeltaPercent}
            tooltip="Temps d'attente avant début du développement (Ready → In Progress)."
          />
          <MetricRow
            label="Dev Actif"
            ia={formatHours(data.ia.avgDevActiveTimeHours)}
            nonIA={formatHours(data.nonIA.avgDevActiveTimeHours)}
            delta={data.deltas.devActiveTimeDeltaPercent}
            tooltip="Temps de codage actif : dernier 'In Progress' → premier commentaire IA/MR (identique au Cycle Dev)."
          />
          <MetricRow
            label="Itérations MR"
            ia={data.ia.avgMRIterations?.toFixed(1) ?? '—'}
            nonIA={data.nonIA.avgMRIterations?.toFixed(1) ?? '—'}
            delta={data.deltas.mrIterationsDeltaPercent}
            tooltip="Nombre moyen d'allers-retours en revue de code."
          />
          <MetricRow
            label="Bugs / US"
            ia={data.ia.bugsPerUSRatio !== null ? data.ia.bugsPerUSRatio.toFixed(2) : '—'}
            nonIA={data.nonIA.bugsPerUSRatio !== null ? data.nonIA.bugsPerUSRatio.toFixed(2) : '—'}
            delta={data.deltas.bugsPerUSDeltaPercent}
            tooltip="Ratio bugs par user story livrée."
          />
          <MetricRow
            label="First Time Right"
            ia={data.ia.firstTimeRightPercent !== null ? `${data.ia.firstTimeRightPercent}%` : '—'}
            nonIA={data.nonIA.firstTimeRightPercent !== null ? `${data.nonIA.firstTimeRightPercent}%` : '—'}
            delta={data.deltas.firstTimeRightDeltaPercent}
            tooltip="Pourcentage d'US approuvées en revue dès la première soumission."
          />
        </tbody>
      </table>

      {data.insights.length > 0 && (
        <div className="mt-4 space-y-1">
          {data.insights.map((insight) => (
            <p key={insight.id} className="text-xs" style={{
              color: insight.severity === 'success' ? '#22c55e' :
                     insight.severity === 'warning' ? '#f59e0b' :
                     insight.severity === 'critical' ? '#ef4444' : '#6b7280',
            }}>
              {insight.severity === 'success' ? '✅' : insight.severity === 'warning' ? '⚠️' : insight.severity === 'critical' ? '🔴' : 'ℹ️'}{' '}
              {insight.message}
            </p>
          ))}
        </div>
      )}

      {data.dataQuality.warnings.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-50">
          {data.dataQuality.warnings.map((w, i) => (
            <p key={i} className="text-xs text-gray-400">⚠ {w}</p>
          ))}
        </div>
      )}
    </div>
  );
};

export default IAComparisonCard;
