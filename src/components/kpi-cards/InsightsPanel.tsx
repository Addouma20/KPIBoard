import React from 'react';
import type { Insight } from '../../types/kpi.types';

interface InsightsPanelProps {
  insights: Insight[];
}

const SEVERITY_ICONS: Record<string, string> = {
  success: '✅',
  info: 'ℹ️',
  warning: '⚠️',
  critical: '🔴',
};

const SEVERITY_COLORS: Record<string, string> = {
  success: '#32C832',
  info: '#527EDB',
  warning: '#FFCC00',
  critical: '#CD3C14',
};

const InsightsPanel: React.FC<InsightsPanelProps> = ({ insights }) => {
  if (insights.length === 0) return null;

  const sorted = [...insights].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2, success: 3 };
    return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
  });

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
        💡 Insights automatiques
      </h3>
      <div className="space-y-2">
        {sorted.map((insight) => (
          <div
            key={insight.id}
            className="flex items-start gap-2 text-sm rounded-lg px-3 py-2"
            style={{ backgroundColor: `${SEVERITY_COLORS[insight.severity]}08` }}
          >
            <span className="flex-shrink-0">{SEVERITY_ICONS[insight.severity]}</span>
            <span style={{ color: SEVERITY_COLORS[insight.severity] }}>{insight.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InsightsPanel;
