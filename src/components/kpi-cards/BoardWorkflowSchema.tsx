import React from 'react';
import type { StatusCount } from '../../types/kpi.types';

export interface KPIValues {
  kpi1_ftrPercent?: number | null;
  kpi2_reworkCount?: number | null;
  kpi3_autonomyPercent?: number | null;
  kpi4_leadTimeDays?: number | null;
}

interface BoardWorkflowSchemaProps {
  statuses: StatusCount[];
  /** Optional computed KPI values to display in brackets */
  kpiValues?: KPIValues;
}

const CATEGORY_STYLE: Record<StatusCount['category'], {
  bg: string; border: string; text: string; dot: string; label: string;
}> = {
  todo:        { bg: '#f9fafb', border: '#d1d5db', text: '#6b7280', dot: '#9ca3af', label: 'À FAIRE' },
  in_progress: { bg: '#eff6ff', border: '#93c5fd', text: '#2563eb', dot: '#3b82f6', label: 'EN COURS' },
  review:      { bg: '#faf5ff', border: '#d8b4fe', text: '#7c3aed', dot: '#a855f7', label: 'EN REVUE' },
  done:        { bg: '#f0fdf4', border: '#86efac', text: '#16a34a', dot: '#22c55e', label: 'TERMINÉ' },
  blocked:     { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626', dot: '#ef4444', label: 'BLOQUÉ' },
  other:       { bg: '#fffbeb', border: '#fcd34d', text: '#d97706', dot: '#f59e0b', label: 'AUTRE' },
};

// Main pipeline order (blocked + other shown inside in_progress if present)
const PIPELINE_ORDER: StatusCount['category'][] = ['todo', 'in_progress', 'review', 'done'];

// KPI bracket definitions
const KPI_BRACKETS = [
  {
    id: 'kpi3',
    label: 'KPI 3 — Taux d\'Autonomie',
    description: '% tickets clos sans que l\'humain touche au code',
    fromCategory: 'todo' as StatusCount['category'],
    toCategory: 'done' as StatusCount['category'],
    color: '#6366f1',
    fromIndex: 0,
    toIndex: 3,
  },
  {
    id: 'kpi4',
    label: 'KPI 4 — Lead Time (Ticket to Merge)',
    description: 'In Progress → Done (jours ouvrés)',
    fromCategory: 'in_progress' as StatusCount['category'],
    toCategory: 'done' as StatusCount['category'],
    color: '#0ea5e9',
    fromIndex: 1,
    toIndex: 3,
  },
  {
    id: 'kpi1',
    label: 'KPI 1 — Taux d\'Approbation',
    description: '% MR fusionnées sans modification demandée',
    fromCategory: 'review' as StatusCount['category'],
    toCategory: 'done' as StatusCount['category'],
    color: '#22c55e',
    fromIndex: 2,
    toIndex: 3,
  },
  {
    id: 'kpi2',
    label: 'KPI 2 — Indice de Rework',
    description: 'Nb allers-retours Revue ↩ En Cours par MR',
    fromCategory: 'review' as StatusCount['category'],
    toCategory: 'in_progress' as StatusCount['category'],
    color: '#f59e0b',
    fromIndex: 2,
    toIndex: 1,
    isLoop: true,
  },
];

const BoardWorkflowSchema: React.FC<BoardWorkflowSchemaProps> = ({ statuses, kpiValues }) => {
  if (statuses.length === 0) return null;

  // Group statuses by category
  const byCategory = new Map<StatusCount['category'], string[]>();
  for (const s of statuses) {
    const list = byCategory.get(s.category) ?? [];
    list.push(s.status);
    byCategory.set(s.category, list);
  }

  // Only show pipeline stages that have at least one status
  const visibleStages = PIPELINE_ORDER.filter((cat) => byCategory.has(cat));
  const blockedStatuses = byCategory.get('blocked') ?? [];
  const otherStatuses = byCategory.get('other') ?? [];

  // Total stage count for bracket width calculation
  const stageCount = visibleStages.length;

  // Column widths in percent for each stage
  const colWidth = stageCount > 0 ? 100 / stageCount : 25;

  // Bracket position helper: given fromIndex and toIndex in visibleStages
  function bracketStyle(fromCat: StatusCount['category'], toCat: StatusCount['category']) {
    const from = visibleStages.indexOf(fromCat);
    const to = visibleStages.indexOf(toCat);
    if (from === -1 || to === -1) return null;
    const left = Math.min(from, to) * colWidth;
    const right = (stageCount - 1 - Math.max(from, to)) * colWidth;
    return { left: `${left}%`, right: `${right}%` };
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base font-semibold text-slate-700">🗺️ Workflow du Board</span>
        <span className="text-xs text-slate-400">Statuts Jira détectés · Calcul des KPIs</span>
      </div>

      {/* Pipeline */}
      <div className="overflow-x-auto pb-1">
        <div
          className="flex items-stretch gap-0 min-w-0"
          style={{ minWidth: `${stageCount * 140}px` }}
        >
          {visibleStages.map((cat, i) => {
            const style = CATEGORY_STYLE[cat];
            const names = byCategory.get(cat) ?? [];
            const isLast = i === visibleStages.length - 1;
            const showBlocked = cat === 'in_progress' && blockedStatuses.length > 0;

            return (
              <React.Fragment key={cat}>
                {/* Stage box */}
                <div
                  className="flex-1 rounded-xl px-3 py-2.5 min-w-[120px]"
                  style={{ background: style.bg, border: `1.5px solid ${style.border}` }}
                >
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: style.text }}>
                    {style.label}
                  </div>
                  <div className="space-y-1">
                    {names.map((name) => (
                      <div key={name} className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
                          style={{ backgroundColor: style.dot }}
                        />
                        <span className="text-[11px] text-slate-600 truncate leading-tight">{name}</span>
                      </div>
                    ))}
                  </div>

                  {/* Blocked sub-box inside In Progress */}
                  {showBlocked && (
                    <div
                      className="mt-2 rounded-lg px-2 py-1.5"
                      style={{ background: CATEGORY_STYLE.blocked.bg, border: `1px solid ${CATEGORY_STYLE.blocked.border}` }}
                    >
                      <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: CATEGORY_STYLE.blocked.text }}>
                        ⛔ BLOQUÉ
                      </div>
                      {blockedStatuses.map((name) => (
                        <div key={name} className="flex items-center gap-1">
                          <span className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" />
                          <span className="text-[10px] text-red-600 truncate">{name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Arrow between stages */}
                {!isLast && (
                  <div className="flex items-center justify-center px-1 flex-shrink-0">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M4 10h12M12 6l4 4-4 4" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Other statuses row (if any) */}
        {otherStatuses.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">AUTRE :</span>
            {otherStatuses.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] text-amber-700"
                style={{ background: '#fffbeb', border: '1px solid #fcd34d' }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block" />
                {name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* KPI brackets */}
      <div className="mt-4 space-y-2 overflow-x-auto">
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Calcul des KPIs</div>
        {KPI_BRACKETS.map((kpi) => {
          const pos = bracketStyle(kpi.fromCategory, kpi.toCategory);
          if (!pos) return null; // skip if stages not present

          // Resolve computed value for this bracket
          let computedValue: string | null = null;
          if (kpiValues) {
            if (kpi.id === 'kpi1' && kpiValues.kpi1_ftrPercent != null) computedValue = `${kpiValues.kpi1_ftrPercent.toFixed(0)}%`;
            if (kpi.id === 'kpi2' && kpiValues.kpi2_reworkCount != null) computedValue = `${kpiValues.kpi2_reworkCount.toFixed(1)} retours/MR`;
            if (kpi.id === 'kpi3' && kpiValues.kpi3_autonomyPercent != null) computedValue = `${kpiValues.kpi3_autonomyPercent.toFixed(0)}%`;
            if (kpi.id === 'kpi4' && kpiValues.kpi4_leadTimeDays != null) computedValue = `${kpiValues.kpi4_leadTimeDays.toFixed(1)}j`;
          }

          return (
            <div key={kpi.id} className="relative h-7" style={{ minWidth: `${stageCount * 140}px` }}>
              {/* Bracket line */}
              <div
                className="absolute top-1/2 -translate-y-1/2 h-0.5 rounded-full"
                style={{ left: pos.left, right: pos.right, backgroundColor: `${kpi.color}40` }}
              />
              {/* Left cap */}
              <div
                className="absolute top-1/2 -translate-y-1/2 h-3 w-0.5 rounded-full"
                style={{ left: pos.left, backgroundColor: kpi.color }}
              />
              {/* Right cap */}
              <div
                className="absolute top-1/2 -translate-y-1/2 h-3 w-0.5 rounded-full"
                style={{ right: pos.right, backgroundColor: kpi.color }}
              />
              {/* Arrow direction for loop (KPI2) */}
              {kpi.isLoop && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 text-[9px] font-bold"
                  style={{ left: `calc(${pos.left} + 4px)`, color: kpi.color }}
                >
                  ↩
                </div>
              )}
              {/* Label + computed value */}
              <div
                className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 whitespace-nowrap flex items-center gap-1.5"
              >
                <span
                  className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{ background: `${kpi.color}15`, color: kpi.color }}
                >
                  {kpi.label}
                </span>
                {computedValue && (
                  <span
                    className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
                    style={{ background: `${kpi.color}25`, color: kpi.color }}
                  >
                    {computedValue}
                  </span>
                )}
                {!computedValue && (
                  <span className="text-[9px] text-slate-400 hidden sm:inline">{kpi.description}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BoardWorkflowSchema;
