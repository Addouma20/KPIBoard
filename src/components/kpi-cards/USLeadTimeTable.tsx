import React, { useState } from 'react';
import type { LeadCycleTimeResult } from '../../types/kpi.types';
import { getThresholdLevel, LEAD_TIME_THRESHOLDS } from '../../kpi/thresholds.config';

interface USLeadTimeTableProps {
  issueDetails: LeadCycleTimeResult[];
  jiraBaseUrl?: string;
}

type SortField = 'issueKey' | 'leadTimeHours' | 'cycleDevTimeHours' | 'readyDate' | 'doneDate';
type SortDir = 'asc' | 'desc';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

function formatHours(hours: number | null): string {
  if (hours === null) return '—';
  return hours.toFixed(1) + 'h';
}

const USLeadTimeTable: React.FC<USLeadTimeTableProps> = ({ issueDetails, jiraBaseUrl }) => {
  const [sortField, setSortField] = useState<SortField>('leadTimeHours');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filter, setFilter] = useState<'all' | 'done' | 'wip'>('all');

  const filtered = issueDetails.filter((d) => {
    if (filter === 'done') return !d.isWIP;
    if (filter === 'wip') return d.isWIP;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    switch (sortField) {
      case 'issueKey':
        return dir * a.issueKey.localeCompare(b.issueKey);
      case 'leadTimeHours':
        return dir * ((a.leadTimeHours ?? -1) - (b.leadTimeHours ?? -1));
      case 'cycleDevTimeHours':
        return dir * ((a.cycleDevTimeHours ?? -1) - (b.cycleDevTimeHours ?? -1));
      case 'readyDate':
        return dir * ((a.readyDate ?? '').localeCompare(b.readyDate ?? ''));
      case 'doneDate':
        return dir * ((a.doneDate ?? '').localeCompare(b.doneDate ?? ''));
      default:
        return 0;
    }
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortIcon = (field: SortField) => {
    if (sortField !== field) return '↕';
    return sortDir === 'asc' ? '↑' : '↓';
  };

  const issueUrl = (key: string) =>
    jiraBaseUrl ? `${jiraBaseUrl}/browse/${key}` : `#${key}`;

  return (
    <div className="mt-4">
      {/* Filters */}
      <div className="mb-3 flex items-center gap-2 text-xs">
        <span className="text-gray-500 font-medium">Filtre :</span>
        {(['all', 'done', 'wip'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 transition-colors ${
              filter === f
                ? 'bg-blue-100 text-blue-700 font-medium'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? `Toutes (${issueDetails.length})` : ''}
            {f === 'done' ? `Done (${issueDetails.filter((d) => !d.isWIP).length})` : ''}
            {f === 'wip' ? `WIP (${issueDetails.filter((d) => d.isWIP).length})` : ''}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              <th className="px-3 py-2 cursor-pointer select-none" onClick={() => handleSort('issueKey')}>
                US {sortIcon('issueKey')}
              </th>
              <th className="px-3 py-2">Titre</th>
              <th className="px-3 py-2 cursor-pointer select-none" onClick={() => handleSort('readyDate')}>
                À faire {sortIcon('readyDate')}
              </th>
              <th className="px-3 py-2 cursor-pointer select-none" onClick={() => handleSort('doneDate')}>
                Terminé {sortIcon('doneDate')}
              </th>
              <th className="px-3 py-2 cursor-pointer select-none text-right" onClick={() => handleSort('leadTimeHours')}>
                Lead Time {sortIcon('leadTimeHours')}
              </th>
              <th className="px-3 py-2 cursor-pointer select-none text-right" onClick={() => handleSort('cycleDevTimeHours')}>
                Cycle Dev {sortIcon('cycleDevTimeHours')}
              </th>
              <th className="px-3 py-2 text-center">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((issue) => {
              const threshold = issue.leadTimeHours !== null
                ? getThresholdLevel(issue.leadTimeHours / 9, LEAD_TIME_THRESHOLDS)
                : null;

              return (
                <tr key={issue.issueKey} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 font-mono text-xs">
                    <a
                      href={issueUrl(issue.issueKey)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {issue.issueKey}
                    </a>
                  </td>
                  <td className="px-3 py-2 max-w-[200px] truncate" title={issue.summary}>
                    {issue.summary}
                  </td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{formatDate(issue.readyDate)}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{formatDate(issue.doneDate)}</td>
                  <td className="px-3 py-2 text-right font-semibold" style={{ color: threshold?.color ?? '#6b7280' }}>
                    {formatHours(issue.leadTimeHours)}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-blue-600">
                    {formatHours(issue.cycleDevTimeHours)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {issue.isWIP ? (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        WIP
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Done
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-400">
                  Aucune US trouvée
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="mt-2 flex gap-4 text-xs text-gray-400">
        <span>{sorted.length} US affichées</span>
        <span>Lead Time = À faire → Terminé · Cycle Dev = En cours → À valider (heures ouvrées 9h-18h)</span>
      </div>
    </div>
  );
};

export default USLeadTimeTable;
