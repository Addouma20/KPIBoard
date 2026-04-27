import React, { useEffect, useState, useCallback } from 'react';
import type { JiraBoard, JiraSprint } from '../types';
import SprintSelector from './SprintSelector';
import DateRangeSelector from './DateRangeSelector';
import KPIGrid from './KPIGrid';
import KanbanKPIGrid from './KanbanKPIGrid';
import AIAgentKPIGrid from './AIAgentKPIGrid';

type BoardMode = 'scrum' | 'kanban';

interface DashboardState {
  boards: JiraBoard[];
  sprints: JiraSprint[];
  selectedSprintId: number | null;
  selectedBoardId: number | null;
  boardMode: BoardMode;
  loading: boolean;
  error: string | null;
}

interface DashboardProps {
  userName: string;
  projectKey: string;
  onDisconnect: () => void;
}

function defaultDateRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = now.toISOString().slice(0, 10);
  const start = new Date(now);
  start.setDate(start.getDate() - 30);
  const startDate = start.toISOString().slice(0, 10);
  return { startDate, endDate };
}

const INITIAL_STATE: DashboardState = {
  boards: [],
  sprints: [],
  selectedSprintId: null,
  selectedBoardId: null,
  boardMode: 'scrum',
  loading: true,
  error: null,
};

const Dashboard: React.FC<DashboardProps> = ({ userName, projectKey, onDisconnect }) => {
  const [state, setState] = useState<DashboardState>(INITIAL_STATE);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<'global' | 'ai-agent'>('global');
  const { startDate: defaultStart, endDate: defaultEnd } = defaultDateRange();
  const [kanbanStartDate, setKanbanStartDate] = useState(defaultStart);
  const [kanbanEndDate, setKanbanEndDate] = useState(defaultEnd);

  const fetchBoardsAndSprints = useCallback(async (forceBoardId?: number) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const boardsRes = await fetch('/api/kpi/boards');
      if (!boardsRes.ok) throw new Error(`Erreur chargement boards (${boardsRes.status})`);
      const boards: JiraBoard[] = await boardsRes.json();

      if (boards.length === 0) {
        setState((s) => ({ ...s, boards, sprints: [], loading: false }));
        return;
      }

      // Select board: forced > first scrum if majority scrum > first kanban
      let selectedBoard: JiraBoard;
      if (forceBoardId) {
        selectedBoard = boards.find((b) => b.id === forceBoardId) ?? boards[0]!;
      } else {
        const scrumCount = boards.filter((b) => b.type === 'scrum').length;
        const kanbanCount = boards.filter((b) => b.type === 'kanban').length;
        if (scrumCount >= kanbanCount) {
          selectedBoard = boards.find((b) => b.type === 'scrum') ?? boards[0]!;
        } else {
          selectedBoard = boards.find((b) => b.type === 'kanban') ?? boards[0]!;
        }
      }

      const boardMode: BoardMode = selectedBoard.type === 'kanban' ? 'kanban' : 'scrum';

      if (boardMode === 'kanban') {
        // Kanban: no sprints needed
        setState({
          boards,
          sprints: [],
          selectedSprintId: null,
          selectedBoardId: selectedBoard.id,
          boardMode: 'kanban',
          loading: false,
          error: null,
        });
        return;
      }

      // Scrum: fetch sprints
      const sprintsRes = await fetch(
        `/api/kpi/sprints?boardId=${encodeURIComponent(selectedBoard.id)}&state=active,closed`,
      );
      if (!sprintsRes.ok) throw new Error(`Erreur chargement sprints (${sprintsRes.status})`);
      const allSprints: JiraSprint[] = await sprintsRes.json();

      // Keep only the last 10 sprints
      const sprints = allSprints.slice(-10);

      const activeSprint = sprints.find((s) => s.state === 'active');
      setState({
        boards,
        sprints,
        selectedSprintId: activeSprint?.id ?? sprints[sprints.length - 1]?.id ?? null,
        selectedBoardId: selectedBoard.id,
        boardMode: 'scrum',
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Erreur inconnue',
      }));
    }
  }, []);

  useEffect(() => {
    fetchBoardsAndSprints();
  }, [fetchBoardsAndSprints]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/kpi/invalidate-cache', { method: 'POST' });
      if (!res.ok) throw new Error('Échec invalidation cache');
      await fetchBoardsAndSprints();
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : 'Erreur lors du rafraîchissement',
      }));
    } finally {
      setRefreshing(false);
    }
  };

  const handleSprintSelect = (sprintId: number) => {
    setState((s) => ({ ...s, selectedSprintId: sprintId }));
  };

  const handleBoardSwitch = (boardId: number) => {
    fetchBoardsAndSprints(boardId);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 lg:px-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Jira KPI Dashboard</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Projet <span className="font-medium text-gray-600">{projectKey}</span> — {userName}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Board selector (only if multiple boards) */}
            {state.boards.length > 1 && (
              <select
                value={state.selectedBoardId ?? ''}
                onChange={(e) => handleBoardSwitch(Number(e.target.value))}
                disabled={state.loading}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm
                           focus:border-blue-500 focus:outline-none focus:ring-2
                           focus:ring-blue-500/20 transition-colors
                           disabled:cursor-not-allowed disabled:opacity-50"
              >
                {state.boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.type})
                  </option>
                ))}
              </select>
            )}

            {state.boardMode === 'scrum' ? (
              <>
                <SprintSelector
                  sprints={state.sprints}
                  selectedSprintId={state.selectedSprintId}
                  onSelect={handleSprintSelect}
                  isLoading={state.loading}
                />
                {(() => {
                  const sprint = state.sprints.find((s) => s.id === state.selectedSprintId);
                  if (!sprint) return null;
                  const fmt = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                  return (
                    <span className="text-xs text-gray-400">
                      {fmt(sprint.startDate)} → {fmt(sprint.endDate)}
                    </span>
                  );
                })()}
              </>
            ) : (
              <DateRangeSelector
                startDate={kanbanStartDate}
                endDate={kanbanEndDate}
                onStartDateChange={setKanbanStartDate}
                onEndDateChange={setKanbanEndDate}
                isLoading={state.loading}
              />
            )}
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
              state.boardMode === 'kanban'
                ? 'bg-purple-50 text-purple-700'
                : 'bg-green-50 text-green-700'
            }`}>
              {state.boardMode === 'kanban' ? 'Kanban' : 'Scrum'}
            </span>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing || state.loading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium
                         text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2
                         focus:ring-blue-500 focus:ring-offset-2 transition-colors
                         disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshing && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              Actualiser
            </button>
            <button
              type="button"
              onClick={onDisconnect}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600
                         hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
        {/* Error banner */}
        {state.error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <span className="font-medium">Erreur :</span> {state.error}
          </div>
        )}

        {/* Loading state */}
        {state.loading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            <span className="ml-3 text-gray-500">Chargement…</span>
          </div>
        )}

        {!state.loading && (state.boardMode === 'kanban' || state.selectedSprintId !== null) && (
          <>
            {/* View tabs */}
            <div className="mb-6 flex gap-1 rounded-xl border border-gray-200 bg-white p-1 w-fit shadow-sm">
              <button
                type="button"
                onClick={() => setView('global')}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  view === 'global'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Vue globale
              </button>
              <button
                type="button"
                onClick={() => setView('ai-agent')}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  view === 'ai-agent'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                🤖 Agent IA
              </button>
            </div>

            {/* Global view */}
            {view === 'global' && state.boardMode === 'scrum' && state.selectedSprintId !== null && (
              <KPIGrid sprintId={state.selectedSprintId} boardId={state.selectedBoardId} />
            )}
            {view === 'global' && state.boardMode === 'kanban' && (
              <KanbanKPIGrid
                projectKey={projectKey}
                startDate={kanbanStartDate}
                endDate={kanbanEndDate}
              />
            )}

            {/* AI Agent view */}
            {view === 'ai-agent' && state.boardMode === 'scrum' && state.selectedSprintId !== null && (
              <AIAgentKPIGrid mode="scrum" sprintId={state.selectedSprintId} />
            )}
            {view === 'ai-agent' && state.boardMode === 'kanban' && (
              <AIAgentKPIGrid
                mode="kanban"
                projectKey={projectKey}
                startDate={kanbanStartDate}
                endDate={kanbanEndDate}
              />
            )}
          </>
        )}

        {/* Empty state — Scrum only */}
        {!state.loading && state.boardMode === 'scrum' && state.sprints.length === 0 && !state.error && (
          <div className="py-20 text-center text-gray-500">
            Aucun sprint disponible. Vérifiez la configuration du board Jira.
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
