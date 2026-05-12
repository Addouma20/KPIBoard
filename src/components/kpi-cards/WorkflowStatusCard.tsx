/**
 * WorkflowStatusCard — Carte Workflow du Projet
 *
 * Affiche chaque statut Jira réel du board sous forme de pilule individuelle,
 * sans aucun regroupement par catégorie.
 * Montre visuellement comment sont calculés Lead Time et Cycle Dev Time.
 */
import React from 'react';
import type { StatusCount } from '../../types/kpi.types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkflowKPIValues {
  kpi1_ftrPercent?: number | null;
  kpi2_reworkCount?: number | null;
  kpi3_autonomyPercent?: number | null;
  kpi4_leadTimeDays?: number | null;
}

interface WorkflowStatusCardProps {
  statuses: StatusCount[];
  kpiValues?: WorkflowKPIValues;
}

// ─── Style per category ───────────────────────────────────────────────────────

const CAT_STYLE: Record<StatusCount['category'], {
  bg: string; border: string; text: string; dot: string;
}> = {
  todo:        { bg: '#f9fafb', border: '#d1d5db', text: '#6b7280', dot: '#9ca3af' },
  in_progress: { bg: '#eff6ff', border: '#93c5fd', text: '#2563eb', dot: '#3b82f6' },
  review:      { bg: '#faf5ff', border: '#d8b4fe', text: '#7c3aed', dot: '#a855f7' },
  done:        { bg: '#f0fdf4', border: '#86efac', text: '#16a34a', dot: '#22c55e' },
  blocked:     { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626', dot: '#ef4444' },
  cancelled:   { bg: '#f8fafc', border: '#cbd5e1', text: '#94a3b8', dot: '#cbd5e1' },
  other:       { bg: '#fffbeb', border: '#fcd34d', text: '#d97706', dot: '#f59e0b' },
};

// Pipeline order: determines left-to-right display order
const PIPELINE_ORDER: StatusCount['category'][] = [
  'todo', 'in_progress', 'review', 'done',
];
// Side statuses shown separately (not part of the main flow line)
const SIDE_CATEGORIES: StatusCount['category'][] = ['blocked', 'cancelled', 'other'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDays(days: number | null | undefined): string {
  if (days == null) return '—';
  return `${days.toFixed(1)}j`;
}

function formatPct(pct: number | null | undefined): string {
  if (pct == null) return '—';
  return `${Math.round(pct)}%`;
}

// ─── Status Pill ──────────────────────────────────────────────────────────────

interface StatusPillProps {
  name: string;
  count: number;
  category: StatusCount['category'];
  highlight?: boolean;
}

const StatusPill: React.FC<StatusPillProps> = ({ name, count, category, highlight }) => {
  const style = CAT_STYLE[category];
  return (
    <div
      className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-center min-w-[90px] max-w-[130px] flex-shrink-0 transition-all"
      style={{
        background: style.bg,
        border: `${highlight ? '2px' : '1.5px'} solid ${style.border}`,
        boxShadow: highlight ? `0 0 0 3px ${style.border}40` : undefined,
      }}
    >
      <span className="text-[11px] font-semibold leading-tight text-center" style={{ color: style.text }}>
        {name}
      </span>
      <span className="text-[9px] font-medium" style={{ color: style.dot }}>
        {count} US
      </span>
    </div>
  );
};

// ─── Arrow ────────────────────────────────────────────────────────────────────

const Arrow: React.FC = () => (
  <span className="text-slate-300 text-sm select-none flex-shrink-0 self-center">→</span>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const WorkflowStatusCard: React.FC<WorkflowStatusCardProps> = ({ statuses, kpiValues }) => {
  if (statuses.length === 0) return null;

  // Separate pipeline statuses from side statuses
  const pipelineStatuses = PIPELINE_ORDER.flatMap((cat) =>
    statuses.filter((s) => s.category === cat)
  );
  const sideStatuses = statuses.filter((s) => SIDE_CATEGORIES.includes(s.category));

  // Index helpers for bracket calculation
  // Each pill takes 1 slot; arrows are between
  const pillIndices: { status: string; category: StatusCount['category']; index: number }[] = [];
  pipelineStatuses.forEach((s, i) => {
    pillIndices.push({ status: s.status, category: s.category, index: i });
  });

  // Find first/last index of each category group in the pipeline
  function firstIndexOfCat(cat: StatusCount['category']): number {
    const found = pillIndices.find((p) => p.category === cat);
    return found ? found.index : -1;
  }
  function lastIndexOfCat(cat: StatusCount['category']): number {
    const reversed = [...pillIndices].reverse();
    const found = reversed.find((p) => p.category === cat);
    return found ? found.index : -1;
  }

  const inProgressFirst = firstIndexOfCat('in_progress');
  const reviewFirst = firstIndexOfCat('review');
  const doneLast = lastIndexOfCat('done');
  const total = pipelineStatuses.length;

  // Bracket visibility
  const showLeadTime = inProgressFirst >= 0 && doneLast >= 0;
  const showCycleDevTime = inProgressFirst >= 0 && reviewFirst >= 0;

  // Bracket width calculation (percentage of total slots 0..total-1)
  // Each slot = pill (90px min) + arrow (20px) ≈ 110px. We use fractional approach.
  function bracketLeft(startIndex: number): string {
    return `${(startIndex / total) * 100}%`;
  }
  function bracketWidth(startIndex: number, endIndex: number): string {
    return `${((endIndex - startIndex + 1) / total) * 100}%`;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-slate-700">🔄 Workflow du Projet</span>
          <span className="text-[11px] text-slate-400 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5">
            {statuses.length} statut{statuses.length > 1 ? 's' : ''} Jira détecté{statuses.length > 1 ? 's' : ''}
          </span>
        </div>
        {/* KPI summary badges */}
        {kpiValues && (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {kpiValues.kpi1_ftrPercent != null && (
              <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">
                KPI1 {formatPct(kpiValues.kpi1_ftrPercent)}
              </span>
            )}
            {kpiValues.kpi2_reworkCount != null && (
              <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
                KPI2 {kpiValues.kpi2_reworkCount.toFixed(1)} rework
              </span>
            )}
            {kpiValues.kpi3_autonomyPercent != null && (
              <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-2 py-0.5">
                KPI3 {formatPct(kpiValues.kpi3_autonomyPercent)}
              </span>
            )}
            {kpiValues.kpi4_leadTimeDays != null && (
              <span className="text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 rounded-full px-2 py-0.5">
                KPI4 {formatDays(kpiValues.kpi4_leadTimeDays)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Pipeline Flow ── */}
      <div className="overflow-x-auto pb-1">
        <div className="flex items-center gap-1 min-w-max">
          {pipelineStatuses.map((s, i) => (
            <React.Fragment key={s.status}>
              <StatusPill
                name={s.status}
                count={s.count}
                category={s.category}
                highlight={s.category === 'in_progress' || s.category === 'done'}
              />
              {i < pipelineStatuses.length - 1 && <Arrow />}
            </React.Fragment>
          ))}
        </div>


      </div>

      {/* ── Side Statuses (blocked, cancelled, other) ── */}
      {sideStatuses.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-2 items-center">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mr-1">Hors flux :</span>
          {sideStatuses.map((s) => {
            const style = CAT_STYLE[s.category];
            return (
              <div
                key={s.status}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1"
                style={{ background: style.bg, border: `1px solid ${style.border}` }}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: style.dot }} />
                <span className="text-[10px] font-medium" style={{ color: style.text }}>{s.status}</span>
                <span className="text-[9px]" style={{ color: style.dot }}>{s.count}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Formula Legend ── */}
      <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Lead Time */}
        <div className="rounded-xl bg-sky-50 border border-sky-100 p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-400 flex-shrink-0" />
            <span className="text-[11px] font-bold text-sky-700">Lead Time — KPI 4 (Ticket to Merge)</span>
          </div>
          <div className="text-[10px] text-sky-600 leading-relaxed">
            <div className="font-mono bg-white/70 rounded px-2 py-1 mb-1 border border-sky-100">
              1er statut <strong>"In Progress"</strong> → <strong>"Done"</strong> (jours ouvrés)
            </div>
            <div>Mesure le temps total entre le début du travail de l'agent IA et la livraison finale.</div>
            {showLeadTime && (
              <div className="mt-1 text-sky-500">
                Statuts In Progress : <span className="font-medium">
                  {statuses.filter((s) => s.category === 'in_progress').map((s) => s.status).join(', ')}
                </span>
                <br />
                Statuts Done : <span className="font-medium">
                  {statuses.filter((s) => s.category === 'done').map((s) => s.status).join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Cycle Dev Time */}
        <div className="rounded-xl bg-purple-50 border border-purple-100 p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
            <span className="text-[11px] font-bold text-purple-700">Cycle Dev Time</span>
          </div>
          <div className="text-[10px] text-purple-600 leading-relaxed">
            <div className="font-mono bg-white/70 rounded px-2 py-1 mb-1 border border-purple-100">
              Dernier statut <strong>"In Progress"</strong> → 1er commentaire <strong>IA/MR</strong> (jours ouvrés)
            </div>
            <div>Mesure le temps de développement pur jusqu'à la première indication de fin de travaux IA (commentaire contenant "MR:", "implémentation terminée", "dev IA", etc.).</div>
            {showCycleDevTime && (
              <div className="mt-1 text-purple-500">
                Fin détectée via commentaire Jira contenant les marqueurs IA/MR configurés.
              </div>
            )}
          </div>
        </div>

        {/* KPI 1 */}
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
            <span className="text-[11px] font-bold text-emerald-700">KPI 1 — Taux d'Approbation (1er passage)</span>
          </div>
          <div className="text-[10px] text-emerald-600 leading-relaxed">
            <div className="font-mono bg-white/70 rounded px-2 py-1 mb-1 border border-emerald-100">
              MR fusionnées sans correction / total MR × 100
            </div>
            <div>% de MR approuvées du 1er coup, sans aucun retour du reviewer.</div>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
            <span className="text-[11px] font-bold text-indigo-700">KPI 3 — Taux d'Autonomie (E2E)</span>
          </div>
          <div className="text-[10px] text-indigo-600 leading-relaxed">
            <div className="font-mono bg-white/70 rounded px-2 py-1 mb-1 border border-indigo-100">
              Tickets <strong>"Done"</strong> sans intervention humaine / total clos × 100
            </div>
            <div>
              Seuls les statuts <strong>Done</strong> comptent (les statuts annulés/cancelled sont exclus).
            </div>
          </div>
        </div>
      </div>

      {/* ── Note cancelled ── */}
      {sideStatuses.some((s) => s.category === 'cancelled') && (
        <div className="mt-3 text-[10px] text-slate-400 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
          ⚠️ Les statuts <strong>annulés/cancelled</strong> sont affichés hors du flux principal et exclus du calcul des KPIs (ils ne représentent pas un travail livré).
        </div>
      )}
    </div>
  );
};

export default WorkflowStatusCard;

// Re-export the KPIValues type under the old name for backward compatibility
export type { WorkflowKPIValues as KPIValues };
