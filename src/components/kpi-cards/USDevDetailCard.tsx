import React, { useEffect, useState } from 'react';
import type { IAUSDetailResult, USDevDetailRow } from '../../types/kpi.types';

interface USDevDetailCardProps {
  mode: 'ia' | 'human';
  projectKey: string;
  startDate: string;
  endDate: string;
  sprintId?: number;
}

function formatDays(days: number | null): string {
  if (days === null) return '—';
  return `${days.toFixed(1)}j`;
}

function formatPoints(pts: number | null): string {
  if (pts === null) return '—';
  return `${pts}`;
}

const USDevDetailCard: React.FC<USDevDetailCardProps> = ({ mode, projectKey, startDate, endDate, sprintId }) => {
  const [data, setData] = useState<IAUSDetailResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sprintId && (!projectKey || !startDate || !endDate)) return;
    let cancelled = false;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const params = sprintId
          ? new URLSearchParams({ sprintId: String(sprintId) })
          : new URLSearchParams({ projectKey, startDate, endDate });
        const res = await fetch(`/api/kpi/ia-us-details?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: IAUSDetailResult = await res.json();
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erreur inconnue');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [projectKey, startDate, endDate, sprintId]);

  const isIA = mode === 'ia';
  const icon = isIA ? '🤖' : '👤';
  const title = isIA ? 'US Dev IA' : 'US Dev Humain';
  const borderColor = isIA ? '#a855f7' : '#3b82f6';
  const bgGradient = isIA
    ? 'linear-gradient(135deg, #faf5ff 0%, #f5f3ff 100%)'
    : 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)';

  const allIssues: USDevDetailRow[] = data
    ? (isIA ? data.iaIssues : data.nonIAIssues)
    : [];
  const issues = allIssues.filter((us) => us.cycleDevTimeDays !== null);
  const hiddenCount = allIssues.length - issues.length;

  if (isLoading) {
    return (
      <div
        className="flex-1 min-w-0 rounded-2xl p-6 shadow-sm animate-pulse"
        style={{ background: bgGradient, border: `1.5px solid ${borderColor}30` }}
      >
        <div className="h-5 bg-gray-200 rounded w-1/3 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex-1 min-w-0 rounded-2xl p-6 shadow-sm"
        style={{ background: bgGradient, border: `1.5px solid ${borderColor}30` }}
      >
        <h3 className="text-sm font-semibold text-gray-700 mb-2">{icon} {title}</h3>
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div
      className="flex-1 min-w-0 rounded-2xl p-6 shadow-sm"
      style={{ background: bgGradient, border: `1.5px solid ${borderColor}30` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <h3 className="text-sm font-bold text-slate-700">{title}</h3>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: `${borderColor}15`, color: borderColor }}
          >
            {issues.length} US avec Cycle Dev
          </span>
          {hiddenCount > 0 && (
            <span className="text-xs text-amber-500 font-medium">
              ({hiddenCount} masquée{hiddenCount > 1 ? 's' : ''})
            </span>
          )}
        </div>
      </div>

      {issues.length === 0 ? (
        <p className="text-sm text-slate-400 italic">Aucune US détectée pour ce profil.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left text-xs font-medium text-slate-400 pb-2 pr-3">US</th>
                <th className="text-left text-xs font-medium text-slate-400 pb-2 pr-3">Statut</th>
                <th className="text-center text-xs font-medium text-slate-400 pb-2 pr-3">Cycle Dev</th>
                <th
                  className="text-center text-xs font-medium text-slate-400 pb-2 pr-3 cursor-default"
                  title="Allers-retours In Review → In Progress. 0 = first-time right · — = jamais passé en review."
                >
                  Nb Review
                </th>
                <th className="text-center text-xs font-medium text-slate-400 pb-2 pr-3">Estimation</th>
                <th className="text-left text-xs font-medium text-slate-400 pb-2">Développeur(s)</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((us) => (
                <tr key={us.key} className="border-b border-slate-50 last:border-0 hover:bg-white/50">
                  <td className="py-2.5 pr-3">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold" style={{ color: borderColor }}>{us.key}</span>
                      <span className="text-xs text-slate-600 truncate max-w-[220px]" title={us.summary}>
                        {us.summary}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3">
                    <StatusBadge status={us.status} />
                  </td>
                  <td className="py-2.5 pr-3 text-center">
                    <CycleDevBadge days={us.cycleDevTimeDays} />
                  </td>
                  <td className="py-2.5 pr-3 text-center">
                    {(us.reviewBackAndForthCount == null) ? (
                      <span className="text-slate-300 text-sm">—</span>
                    ) : (
                      <span
                        className="inline-flex items-center justify-center rounded-full w-6 h-6 text-xs font-bold"
                        style={{
                          backgroundColor:
                            us.reviewBackAndForthCount === 0 ? '#dcfce7' :
                            us.reviewBackAndForthCount === 1 ? '#fef3c7' : '#fee2e2',
                          color:
                            us.reviewBackAndForthCount === 0 ? '#16a34a' :
                            us.reviewBackAndForthCount === 1 ? '#d97706' : '#dc2626',
                        }}
                      >
                        {us.reviewBackAndForthCount}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-center">
                    <span className="text-sm font-semibold text-slate-600">
                      {formatPoints(us.storyPoints)}
                      {us.storyPoints !== null && <span className="text-[10px] text-slate-400 ml-0.5">pts</span>}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {us.contributors.length > 0
                        ? us.contributors.map((dev) => (
                            <span
                              key={dev}
                              className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600"
                            >
                              {dev}
                            </span>
                          ))
                        : <span className="text-[10px] text-slate-400 italic">{us.assignee}</span>
                      }
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// --- Sub-components ---

function StatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  let color = '#6b7280';
  if (lower.includes('done') || lower.includes('terminé') || lower.includes('fermé') || lower.includes('closed')) {
    color = '#22c55e';
  } else if (lower.includes('progress') || lower.includes('cours') || lower.includes('développement')) {
    color = '#3b82f6';
  } else if (lower.includes('review') || lower.includes('revue') || lower.includes('test')) {
    color = '#a855f7';
  } else if (lower.includes('blocked') || lower.includes('bloqué')) {
    color = '#ef4444';
  }

  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap"
      style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}
    >
      {status}
    </span>
  );
}

function CycleDevBadge({ days }: { days: number | null }) {
  if (days === null) return <span className="text-slate-300 text-xs">—</span>;
  const color = days <= 2 ? '#22c55e' : days <= 5 ? '#f59e0b' : '#ef4444';
  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 text-xs font-semibold"
      style={{ background: `${color}15`, color }}
    >
      {formatDays(days)}
    </span>
  );
}

export default USDevDetailCard;
