import React from 'react';
import type { JiraSprint } from '../types';

interface SprintSelectorProps {
  sprints: JiraSprint[];
  selectedSprintId: number | null;
  onSelect: (sprintId: number) => void;
  isLoading: boolean;
}

const SprintSelector: React.FC<SprintSelectorProps> = ({
  sprints,
  selectedSprintId,
  onSelect,
  isLoading,
}) => {
  const sorted = [...sprints].sort((a, b) => {
    if (a.state === 'active' && b.state !== 'active') return -1;
    if (b.state === 'active' && a.state !== 'active') return 1;
    return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
  });

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = Number(e.target.value);
    if (!isNaN(value) && value > 0) {
      onSelect(value);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <label htmlFor="sprint-select" className="text-sm font-medium text-gray-700">
        Sprint
      </label>
      <select
        id="sprint-select"
        value={selectedSprintId ?? ''}
        onChange={handleChange}
        disabled={isLoading || sprints.length === 0}
        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm
                   focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500
                   disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="" disabled>
          {isLoading ? 'Chargement…' : 'Sélectionner un sprint'}
        </option>
        {sorted.map((sprint) => (
          <option key={sprint.id} value={sprint.id}>
            {sprint.name}
            {sprint.state === 'active' ? ' (Active)' : ''}
          </option>
        ))}
      </select>
      {isLoading && (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      )}
    </div>
  );
};

export default SprintSelector;
