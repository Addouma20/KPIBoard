import React, { useEffect, useState } from 'react';
import type { IAComparisonMetrics, IAComparisonResult, StatusCount } from '../../types/kpi.types';
import KPITooltip from './KPITooltip';

const USDevDetailCard = React.lazy(() => import('./USDevDetailCard'));

interface KPIDevCardsProps {
  projectKey: string;
  startDate: string;
  endDate: string;
  /** Sprint ID for Scrum mode (uses sprint-based filtering) */
  sprintId?: number;
  /** Statuts réels du board, pour personnaliser les explications */
  statuses: StatusCount[];
  /** Called once KPI values are loaded, for the workflow bracket display */
  onKPIValues?: (values: import('./WorkflowStatusCard').WorkflowKPIValues) => void;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatHours(h: number | null): string {
  if (h === null) return '—';
  const days = h / 9;
  if (days < 1) return `${Math.round(h)}h`;
  return `${days.toFixed(1)}j`;
}

function pct(v: number | null): string {
  return v !== null ? `${v.toFixed(0)}%` : '—';
}

function rework(v: number | null): string {
  return v !== null ? `${v.toFixed(1)}` : '—';
}

function scoreColor(v: number | null, kpi: 'ftr' | 'rework' | 'autonomy' | 'lead'): string {
  if (v === null) return '#9ca3af';
  if (kpi === 'ftr')     return v >= 70 ? '#22c55e' : v >= 50 ? '#f59e0b' : '#ef4444';
  if (kpi === 'rework')  return v <= 0.2 ? '#22c55e' : v <= 0.8 ? '#f59e0b' : '#ef4444';
  if (kpi === 'autonomy') return v >= 70 ? '#22c55e' : v >= 40 ? '#f59e0b' : '#ef4444';
  if (kpi === 'lead')    return v <= 3 ? '#22c55e' : v <= 7 ? '#f59e0b' : '#ef4444';
  return '#9ca3af';
}

// ─── Dynamic formula builders ─────────────────────────────────────────────────

function names(statuses: StatusCount[], cat: StatusCount['category']): string[] {
  return statuses.filter((s) => s.category === cat).map((s) => s.status);
}

function pill(label: string, color: string) {
  return (
    <span
      key={label}
      className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium mx-0.5"
      style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
    >
      {label}
    </span>
  );
}

// ─── Tooltip content builders (rich React content) ───────────────────────────

/** Renders colored status badge pills for the tooltip */
function TooltipStatusBadges({ label, statList, color }: { label: string; statList: string[]; color: string }) {
  if (statList.length === 0) return null;
  return (
    <div className="mt-1.5">
      <span className="opacity-60">{label} : </span>
      {statList.map((s) => (
        <span
          key={s}
          className="inline-block rounded px-1 py-0.5 text-[9px] font-medium mx-0.5"
          style={{ background: `${color}30`, color, border: `1px solid ${color}50` }}
        >
          {s}
        </span>
      ))}
    </div>
  );
}

function TooltipKPI1({ statuses, metrics }: { statuses: StatusCount[]; metrics: IAComparisonMetrics | null }) {
  const reviewSt = names(statuses, 'review');
  const doneSt = names(statuses, 'done');
  const total = metrics?.totalUS ?? null;
  const ftr = metrics?.firstTimeRightPercent ?? null;
  const ftrCount = (ftr !== null && total !== null) ? Math.round(total * ftr / 100) : null;
  return (
    <div className="text-[11px] leading-relaxed">
      <div className="font-semibold mb-1">✅ KPI 1 — Taux d'Approbation (1er passage)</div>
      <div className="opacity-80 mb-1.5">% de MR fusionnées sans aucune modification demandée.</div>
      <div className="font-mono bg-white/10 rounded px-2 py-1 mb-1.5 text-[10px]">
        = MR approuvées 1er coup / total MR × 100
      </div>
      {ftrCount !== null && total !== null && (
        <div className="mb-1 opacity-90">
          → <strong>{ftrCount}</strong> MR / <strong>{total}</strong> total = <strong>{pct(ftr)}</strong>
        </div>
      )}
      <TooltipStatusBadges label="Statuts revue" statList={reviewSt} color="#a855f7" />
      <TooltipStatusBadges label="Statuts done" statList={doneSt} color="#22c55e" />
    </div>
  );
}

function TooltipKPI2({ statuses, metrics }: { statuses: StatusCount[]; metrics: IAComparisonMetrics | null }) {
  const reviewSt = names(statuses, 'review');
  const inprogSt = names(statuses, 'in_progress');
  const total = metrics?.totalMRWithReviewData ?? null;
  const reworkVal = metrics?.avgReworkCount ?? null;
  const totalRetours = metrics?.totalReworkCount ?? null;
  return (
    <div className="text-[11px] leading-relaxed">
      <div className="font-semibold mb-1">🔄 KPI 2 — Indice de Rework</div>
      <div className="opacity-80 mb-1.5">Nb moyen d'allers-retours (revue ↩ dev) par MR.</div>
      <div className="font-mono bg-white/10 rounded px-2 py-1 mb-1.5 text-[10px]">
        = Σ retours / total MR
      </div>
      {totalRetours !== null && total !== null && (
        <div className="mb-1 opacity-90">
          → <strong>{totalRetours}</strong> retour{totalRetours !== 1 ? 's' : ''} / <strong>{total}</strong> MR = <strong>{rework(reworkVal)}</strong>
        </div>
      )}
      <TooltipStatusBadges label="Statuts revue" statList={reviewSt} color="#a855f7" />
      <TooltipStatusBadges label="Retour vers" statList={inprogSt} color="#3b82f6" />
    </div>
  );
}

function TooltipKPI3({ statuses, metrics, mode }: { statuses: StatusCount[]; metrics: IAComparisonMetrics | null; mode: 'ia' | 'human' }) {
  const doneSt = names(statuses, 'done');
  const total = metrics?.totalUS ?? null;
  const completionPct = metrics?.completionRatePercent ?? null;
  const doneCount = (completionPct !== null && total !== null) ? Math.round(total * completionPct / 100) : null;
  const label = mode === 'ia' ? 'compte workflow IA' : 'développeur humain';
  return (
    <div className="text-[11px] leading-relaxed">
      <div className="font-semibold mb-1">🤖 KPI 3 — Taux d'Autonomie</div>
      <div className="opacity-80 mb-1.5">
        % tickets {doneSt.length > 0 ? `"${doneSt[0]}"` : 'Done'} posés par le <strong>{label}</strong>.
      </div>
      <div className="font-mono bg-white/10 rounded px-2 py-1 mb-1.5 text-[10px]">
        = tickets clos par profil / total clos × 100
      </div>
      {doneCount !== null && total !== null && (
        <div className="mb-1 opacity-90">
          → <strong>{doneCount}</strong> US / <strong>{total}</strong> total = <strong>{pct(completionPct)}</strong>
        </div>
      )}
      <TooltipStatusBadges label="Statuts done" statList={doneSt} color="#22c55e" />
    </div>
  );
}

function TooltipKPI4({ statuses, metrics }: { statuses: StatusCount[]; metrics: IAComparisonMetrics | null }) {
  const inprogSt = names(statuses, 'in_progress');
  const doneSt = names(statuses, 'done');
  const leadHours = metrics?.avgLeadTimeHours ?? null;
  const leadDays = leadHours !== null ? leadHours / 9 : null;
  const total = metrics?.totalUS ?? null;
  return (
    <div className="text-[11px] leading-relaxed">
      <div className="font-semibold mb-1">⏱ KPI 4 — Lead Time (Ticket to Merge)</div>
      <div className="opacity-80 mb-1.5">Temps entre le 1er statut "en cours" et "terminé", en jours ouvrés.</div>
      <div className="font-mono bg-white/10 rounded px-2 py-1 mb-1.5 text-[10px]">
        = 1er statut In Progress → Done (lun-ven 9h-18h)
      </div>
      {leadDays !== null && total !== null && (
        <div className="mb-1 opacity-90">
          → Moyenne <strong>{leadDays.toFixed(1)}j</strong> sur <strong>{total}</strong> US
        </div>
      )}
      <TooltipStatusBadges label="Statuts En cours" statList={inprogSt} color="#3b82f6" />
      <TooltipStatusBadges label="Statuts Done" statList={doneSt} color="#22c55e" />
    </div>
  );
}

function TooltipKPI5({ statuses, metrics, mode }: { statuses: StatusCount[]; metrics: IAComparisonMetrics | null; mode: 'ia' | 'human' }) {
  const inprogSt = names(statuses, 'in_progress');
  const reviewSt = names(statuses, 'review');
  const cycleHours = metrics?.avgCycleDevTimeHours ?? null;
  const cycleDays = cycleHours !== null ? cycleHours / 9 : null;
  const count = metrics?.cycleDevUSCount ?? null;
  const isIA = mode === 'ia';
  return (
    <div className="text-[11px] leading-relaxed">
      <div className="font-semibold mb-1">🔬 KPI 5 — Cycle Dev Time</div>
      {isIA ? (
        <>
          <div className="opacity-80 mb-1.5">Temps de développement actif : de l'assignation de la carte au premier commentaire indiquant la fin des travaux IA.</div>
          <div className="font-mono bg-white/10 rounded px-2 py-1 mb-1.5 text-[10px]">
            = Assigné à moi → 1er commentaire IA (jours ouvrés)
          </div>
        </>
      ) : (
        <>
          <div className="opacity-80 mb-1.5">Temps de développement actif : du premier passage en cours au premier passage en revue.</div>
          <div className="font-mono bg-white/10 rounded px-2 py-1 mb-1.5 text-[10px]">
            = 1er In Progress → 1ère In Review (jours ouvrés)
          </div>
        </>
      )}
      {cycleDays !== null && count !== null && (
        <div className="mb-1 opacity-90">
          → Moyenne <strong>{cycleDays.toFixed(1)}j</strong> sur <strong>{count}</strong> US
        </div>
      )}
      {isIA ? (
        <div className="mt-1 text-[10px] opacity-70">Début : 1er événement changelog "assignee" (Assign to me). Fin : 1er commentaire contenant "MR:", "implémentation terminée", "dev IA", etc.</div>
      ) : (
        <>
          <TooltipStatusBadges label="Début" statList={inprogSt} color="#3b82f6" />
          <TooltipStatusBadges label="Fin" statList={reviewSt} color="#a855f7" />
        </>
      )}
    </div>
  );
}


function FormulaKPI1({ statuses }: { statuses: StatusCount[] }) {
  const review = names(statuses, 'review');
  const done = names(statuses, 'done');
  if (review.length === 0 && done.length === 0)
    return <span className="text-slate-400 italic">Nécessite des statuts de revue</span>;
  return (
    <span>
      MR {review.length > 0 ? (<>depuis {review.map(n => pill(n, '#a855f7'))}</>) : 'en revue '}
      →{done.map(n => pill(n, '#22c55e'))} <span className="text-slate-400">sans demande de correction</span>
      <span className="ml-1 text-slate-400">= <strong className="text-slate-600">nbMR₁ / totalMR × 100</strong></span>
    </span>
  );
}

function FormulaKPI2({ statuses }: { statuses: StatusCount[] }) {
  const review = names(statuses, 'review');
  const inprog = names(statuses, 'in_progress');
  return (
    <span>
      {review.length > 0 ? review.map(n => pill(n, '#a855f7')) : <span className="text-slate-400">Revue </span>}
      ↩{inprog.length > 0 ? inprog.map(n => pill(n, '#3b82f6')) : <span className="text-slate-400"> En cours</span>}
      <span className="ml-1 text-slate-400">= <strong className="text-slate-600">Σ retours / nbMR</strong></span>
      <span className="ml-1 text-slate-400">(0 = aucun rework)</span>
    </span>
  );
}

function FormulaKPI3({ statuses, mode }: { statuses: StatusCount[]; mode: 'ia' | 'human' }) {
  const done = names(statuses, 'done');
  const actor = mode === 'ia' ? (
    <span className="font-medium text-purple-600">compte workflow IA</span>
  ) : (
    <span className="font-medium text-slate-600">développeur humain</span>
  );
  return (
    <span>
      Tickets {done.length > 0 ? done.map(n => pill(n, '#22c55e')) : <span className="text-slate-400">Done</span>}
      {' '}posés par le {actor}
      <span className="ml-1 text-slate-400">= <strong className="text-slate-600">nbClos{mode === 'ia' ? 'IA' : 'H'} / totalClos × 100</strong></span>
    </span>
  );
}

function FormulaKPI4({ statuses }: { statuses: StatusCount[] }) {
  const inprog = names(statuses, 'in_progress');
  const done = names(statuses, 'done');
  return (
    <span>
      1er {inprog.length > 0 ? inprog.map(n => pill(n, '#3b82f6')) : <span className="text-slate-400">In Progress</span>}
      {' '}→{' '}{done.length > 0 ? done.map(n => pill(n, '#22c55e')) : <span className="text-slate-400">Done</span>}
      <span className="ml-1 text-slate-400">en jours ouvrés (lun-ven 9h-18h)</span>
    </span>
  );
}

function FormulaKPI5({ statuses, mode }: { statuses: StatusCount[]; mode: 'ia' | 'human' }) {
  const inprog = names(statuses, 'in_progress');
  const review = names(statuses, 'review');
  if (mode === 'ia') {
    return (
      <span>
        <span className="font-medium text-purple-600">Assigné à moi</span>
        {' '}→ 1er commentaire <span className="font-medium text-purple-600">IA</span>
        <span className="ml-1 text-slate-400">= temps dev actif (jours ouvrés)</span>
      </span>
    );
  }
  return (
    <span>
      1er {inprog.length > 0 ? inprog.map(n => pill(n, '#3b82f6')) : <span className="text-slate-400">In Progress</span>}
      {' '}→ 1ère {review.length > 0 ? review.map(n => pill(n, '#a855f7')) : <span className="text-slate-400">In Review</span>}
      <span className="ml-1 text-slate-400">= temps dev actif (jours ouvrés)</span>
    </span>
  );
}

// ─── Single KPI row ───────────────────────────────────────────────────────────

interface KPIRowProps {
  number: string;
  label: string;
  value: string;
  color: string;
  formula: React.ReactNode;
  tooltip?: React.ReactNode;
  subLabel?: string;
}

const KPIRow: React.FC<KPIRowProps> = ({ number, label, value, color, formula, tooltip, subLabel }) => (
  <div className="flex flex-col gap-1 py-3 border-b border-slate-50 last:border-0">
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span
          className="inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold"
          style={{ background: `${color}15`, color }}
        >
          {number}
        </span>
        {tooltip ? (
          <KPITooltip content={tooltip}>
            <span className="text-sm font-semibold text-slate-700">{label}</span>
          </KPITooltip>
        ) : (
          <span className="text-sm font-semibold text-slate-700">{label}</span>
        )}
      </div>
      <div className="flex flex-col items-end flex-shrink-0">
        <span
          className="text-xl font-extrabold tabular-nums"
          style={{ color }}
        >
          {value}
        </span>
        {subLabel && (
          <span className="text-[10px] font-medium text-slate-400">{subLabel}</span>
        )}
      </div>
    </div>
    <div className="text-[10px] text-slate-500 leading-relaxed flex flex-wrap items-center gap-0.5 pl-7">
      {formula}
    </div>
  </div>
);

// ─── One profile card ─────────────────────────────────────────────────────────

interface ProfileCardProps {
  mode: 'ia' | 'human';
  metrics: IAComparisonMetrics | null;
  statuses: StatusCount[];
  isLoading: boolean;
}

const ProfileCard: React.FC<ProfileCardProps> = ({ mode, metrics, statuses, isLoading }) => {
  const isIA = mode === 'ia';
  const icon = isIA ? '🤖' : '👤';
  const title = isIA ? 'Dev IA' : 'Dev Humain';
  const borderColor = isIA ? '#a855f7' : '#3b82f6';
  const bgGradient = isIA
    ? 'linear-gradient(135deg, #faf5ff 0%, #f5f3ff 100%)'
    : 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)';

  const reworkVal = metrics?.avgReworkCount ?? null;
  const leadDays = metrics?.avgLeadTimeHours !== null && metrics?.avgLeadTimeHours != null
    ? (metrics.avgLeadTimeHours ?? 0) / 9
    : null;
  const cycleDevDays = metrics?.avgCycleDevTimeHours !== null && metrics?.avgCycleDevTimeHours != null
    ? (metrics.avgCycleDevTimeHours ?? 0) / 9
    : null;

  const kpis: KPIRowProps[] = [
    {
      number: 'KPI 1',
      label: "Taux d'Approbation",
      value: pct(metrics?.firstTimeRightPercent ?? null),
      color: scoreColor(metrics?.firstTimeRightPercent ?? null, 'ftr'),
      formula: <FormulaKPI1 statuses={statuses} />,
      tooltip: <TooltipKPI1 statuses={statuses} metrics={metrics} />,
    },
    {
      number: 'KPI 2',
      label: 'Indice de Rework',
      value: rework(reworkVal),
      color: scoreColor(reworkVal, 'rework'),
      formula: <FormulaKPI2 statuses={statuses} />,
      tooltip: <TooltipKPI2 statuses={statuses} metrics={metrics} />,
      subLabel: metrics?.totalReworkCount != null
        ? `${metrics.totalReworkCount} retour${metrics.totalReworkCount > 1 ? 's' : ''} détecté${metrics.totalReworkCount > 1 ? 's' : ''}`
        : undefined,
    },
    {
      number: 'KPI 3',
      label: "Taux d'Autonomie",
      value: pct(isIA ? (metrics?.completionRatePercent ?? null) : metrics?.completionRatePercent !== null ? (100 - (metrics?.completionRatePercent ?? 0)) : null),
      color: scoreColor(metrics?.completionRatePercent ?? null, 'autonomy'),
      formula: <FormulaKPI3 statuses={statuses} mode={mode} />,
      tooltip: <TooltipKPI3 statuses={statuses} metrics={metrics} mode={mode} />,
    },
    {
      number: 'KPI 4',
      label: 'Lead Time (Ticket to Merge)',
      value: leadDays !== null ? `${leadDays.toFixed(1)}j` : '—',
      color: scoreColor(leadDays, 'lead'),
      formula: <FormulaKPI4 statuses={statuses} />,
      tooltip: <TooltipKPI4 statuses={statuses} metrics={metrics} />,
    },
    {
      number: 'KPI 5',
      label: 'Cycle Dev Time',
      value: cycleDevDays !== null ? `${cycleDevDays.toFixed(1)}j` : '—',
      color: scoreColor(cycleDevDays, 'lead'),
      formula: <FormulaKPI5 statuses={statuses} mode={mode} />,
      tooltip: <TooltipKPI5 statuses={statuses} metrics={metrics} mode={mode} />,
      subLabel: metrics?.cycleDevUSCount != null
        ? `moy. sur ${metrics.cycleDevUSCount} US`
        : undefined,
    },
  ];

  return (
    <div
      className="flex-1 rounded-2xl p-5 shadow-sm min-w-0"
      style={{ background: bgGradient, border: `1.5px solid ${borderColor}30` }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <div className="text-sm font-bold text-slate-700">{title}</div>
        </div>
        <div
          className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: `${borderColor}15`, color: borderColor }}
        >
          {isIA ? 'Assisté IA' : 'Manuel'}
        </div>
      </div>

      {/* US count stat */}
      {metrics && (
        <div
          className="flex items-center justify-between rounded-xl px-4 py-2.5 mb-4"
          style={{ background: `${borderColor}10`, border: `1px solid ${borderColor}25` }}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">📋</span>
            <span className="text-xs font-medium text-slate-600">US Dev</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-2xl font-extrabold tabular-nums"
              style={{ color: borderColor }}
            >
              {metrics.totalUS}
            </span>
            {metrics.completionRatePercent !== null && (
              <span className="text-[10px] font-medium text-slate-400 leading-tight text-right">
                {Math.round(metrics.totalUS * metrics.completionRatePercent / 100)} terminées<br />
                {metrics.totalUS - Math.round(metrics.totalUS * metrics.completionRatePercent / 100)} en cours
              </span>
            )}
          </div>
        </div>
      )}

      {/* KPI rows */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-10 rounded-xl bg-white/60 mb-4" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-white/60" />
          ))}
        </div>
      ) : metrics ? (
        <div>
          {kpis.map((kpi) => (
            <KPIRow key={kpi.number} {...kpi} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400 italic mt-4">Aucune US détectée pour ce profil.</p>
      )}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const KPIDevCards: React.FC<KPIDevCardsProps> = ({ projectKey, startDate, endDate, sprintId, statuses, onKPIValues }) => {
  const [result, setResult] = useState<IAComparisonResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectKey || !startDate || !endDate) return;
    let cancelled = false;

    const fetch_ = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ projectKey, startDate, endDate });
        const res = await fetch(`/api/kpi/ia-comparison?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: IAComparisonResult = await res.json();
        if (!cancelled) {
          setResult(json);
          if (onKPIValues) {
            // Use IA metrics as primary; fall back to non-IA if IA has no data
            const m = json.ia.totalUS > 0 ? json.ia : json.nonIA;
            const reworkVal = m.avgMRIterations != null ? Math.max(0, m.avgMRIterations - 1) : null;
            onKPIValues({
              kpi1_ftrPercent: m.firstTimeRightPercent,
              kpi2_reworkCount: reworkVal,
              kpi3_autonomyPercent: m.completionRatePercent,
              kpi4_leadTimeDays: m.avgLeadTimeHours != null ? m.avgLeadTimeHours / 9 : null,
            });
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erreur');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetch_();
    return () => { cancelled = true; };
  }, [projectKey, startDate, endDate, onKPIValues]);

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-slate-600">📊 Synthèse KPIs par profil</span>
        <span className="text-[10px] text-slate-400">4 KPIs · calcul adapté aux statuts de ce projet</span>
      </div>

      {error && (
        <p className="text-xs text-red-400 mb-3">
          Données IA non disponibles — affichage sans comparaison. <span className="opacity-60">{error}</span>
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-4">
        <ProfileCard
          mode="ia"
          metrics={result?.ia ?? null}
          statuses={statuses}
          isLoading={isLoading}
        />
        <ProfileCard
          mode="human"
          metrics={result?.nonIA ?? null}
          statuses={statuses}
          isLoading={isLoading}
        />
      </div>

      {/* US Detail cards — list per profile */}
      <div className="flex flex-col sm:flex-row gap-4 mt-4">
        <React.Suspense fallback={<div className="flex-1 h-40 animate-pulse rounded-2xl bg-white/60" />}>
          <USDevDetailCard mode="ia" projectKey={projectKey} startDate={startDate} endDate={endDate} sprintId={sprintId} />
        </React.Suspense>
        <React.Suspense fallback={<div className="flex-1 h-40 animate-pulse rounded-2xl bg-white/60" />}>
          <USDevDetailCard mode="human" projectKey={projectKey} startDate={startDate} endDate={endDate} sprintId={sprintId} />
        </React.Suspense>
      </div>
    </div>
  );
};

export default KPIDevCards;
