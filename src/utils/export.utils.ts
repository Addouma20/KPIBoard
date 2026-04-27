import type { USTableRow, SprintKPIDashboard } from '../types';

export function exportToCSV(rows: USTableRow[], sprintName: string): void {
  const headers = ['Cle', 'Titre', 'Statut', 'Lead Time (j)', 'Iterations MR', 'Bugs', 'Bugs Actifs', 'Score Qualite', 'URL Jira'];
  const csvLines = [
    headers.join(';'),
    ...rows.map(row => [
      row.key,
      `"${row.summary.replace(/"/g, '""')}"`,
      row.status,
      row.leadTimeDays ?? '',
      row.mrIterations ?? '',
      row.bugsCount,
      row.activeBugsCount,
      row.qualityScore,
      row.jiraUrl,
    ].join(';')),
  ];

  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `kpi-${sanitizeFilename(sprintName)}-${dateStamp()}.csv`);
}

export function exportToJSON(data: SprintKPIDashboard, sprintName: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `kpi-${sanitizeFilename(sprintName)}-${dateStamp()}.json`);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
}

export function calculateQualityScore(
  mrIterations: number | null,
  activeBugsCount: number,
  leadTimeDays: number | null,
  leadTimeWarningDays = 10
): number {
  let score = 100;
  if (mrIterations !== null && mrIterations > 1) {
    score -= (mrIterations - 1) * 10;
  }
  score -= activeBugsCount * 15;
  if (leadTimeDays !== null && leadTimeDays > leadTimeWarningDays) {
    score -= (leadTimeDays - leadTimeWarningDays) * 5;
  }
  return Math.max(0, Math.round(score));
}
