import { JiraClient } from '../clients/jira-client';
import { calculateKanbanAllKPIs } from './kanban-kpi';
import type { KanbanTrendPoint } from '../types/kpi.types';
import type { Result } from '../types/result.types';
import { success } from '../types/result.types';

function getMonthRanges(months: number): Array<{ label: string; startDate: string; endDate: string }> {
  const ranges: Array<{ label: string; startDate: string; endDate: string }> = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

    const pad = (n: number) => String(n).padStart(2, '0');
    const startDate = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
    const endDate = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;

    const label = start.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });

    ranges.push({ label, startDate, endDate });
  }

  return ranges;
}

export async function calculateKanbanTrend(
  jiraClient: JiraClient,
  projectKey: string,
  months = 6,
): Promise<Result<KanbanTrendPoint[]>> {
  const ranges = getMonthRanges(months);

  const points: KanbanTrendPoint[] = [];

  for (const range of ranges) {
    const result = await calculateKanbanAllKPIs(
      jiraClient,
      projectKey,
      range.startDate,
      range.endDate,
    );

    if (result.success) {
      const d = result.data;
      points.push({
        monthLabel: range.label,
        startDate: range.startDate,
        endDate: range.endDate,
        completionRate: d.completionRate?.completionRatePercent ?? null,
        avgMRIterations: d.mrIterations?.averageIterations ?? null,
        avgLeadTimeHours: d.leadCycleTime?.leadTime.averageHours ?? null,
        avgCycleDevTimeHours: d.leadCycleTime?.cycleDevTime.averageHours ?? null,
        bugsPerUSRatio: d.bugs?.bugsPerUSRatio ?? null,
      });
    } else {
      points.push({
        monthLabel: range.label,
        startDate: range.startDate,
        endDate: range.endDate,
        completionRate: null,
        avgMRIterations: null,
        avgLeadTimeHours: null,
        avgCycleDevTimeHours: null,
        bugsPerUSRatio: null,
      });
    }
  }

  return success(points);
}
