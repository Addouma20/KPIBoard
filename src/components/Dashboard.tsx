import React, { useEffect, useState, useCallback } from 'react';
import type { JiraBoard, JiraSprint } from '../types';
import SprintSelector from './SprintSelector';
import DateRangeSelector from './DateRangeSelector';
import KPIGrid from './KPIGrid';
import KanbanKPIGrid from './KanbanKPIGrid';

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
  onChangeProject: () => void;
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

const Dashboard: React.FC<DashboardProps> = ({ userName, projectKey, onDisconnect, onChangeProject }) => {
  const [state, setState] = useState<DashboardState>(INITIAL_STATE);
  const [refreshing, setRefreshing] = useState(false);
  const { startDate: defaultStart, endDate: defaultEnd } = defaultDateRange();
  const [kanbanStartDate, setKanbanStartDate] = useState(defaultStart);
  const [kanbanEndDate, setKanbanEndDate] = useState(defaultEnd);

  const fetchBoardsAndSprints = useCallback(async (forceBoardId?: number) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const boardsRes = await fetch('/api/kpi/boards');
      if (!boardsRes.ok) {
        let detail = `Erreur chargement boards (${boardsRes.status})`;
        try {
          const body = await boardsRes.json();
          if (body?.error?.message) detail += ` — ${body.error.message}`;
          else if (body?.error) detail += ` — ${JSON.stringify(body.error)}`;
        } catch { /* ignore parse error */ }
        throw new Error(detail);
      }
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
    <div className="min-h-screen bg-gray-100">
      {/* Header Orange dark */}
      <header className="bg-gray-900 text-white shadow-md">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-orange-500" aria-hidden="true">
              <svg viewBox="0 0 50 50" className="h-5 w-5" fill="none">
                <rect width="50" height="50" rx="4" fill="#FF7900"/>
                <rect x="14" y="14" width="22" height="22" rx="2" fill="#fff"/>
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">KPI Dashboard</h1>
              <p className="text-xs text-gray-400">
                <span className="text-gray-200 font-medium">{projectKey}</span> — {userName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Board selector (only if multiple boards) */}
            {state.boards.length > 1 && (
              <select
                value={state.selectedBoardId ?? ''}
                onChange={(e) => handleBoardSwitch(Number(e.target.value))}
                disabled={state.loading}
                aria-label="Sélection du board"
                className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-200
                           focus:border-orange-500 focus:outline-none focus:ring-2
                           focus:ring-orange-500/30 transition-colors
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
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${
              state.boardMode === 'kanban'
                ? 'bg-purple-900/50 text-purple-200'
                : 'bg-green-900/50 text-green-200'
            }`}>
              {state.boardMode === 'kanban' ? 'Kanban' : 'Scrum'}
            </span>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing || state.loading}
              aria-label="Actualiser les données"
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold
                         text-gray-900 hover:bg-orange-600 focus:outline-none focus:ring-2
                         focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors
                         disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshing && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" aria-hidden="true" />
              )}
              Actualiser
            </button>
            <button
              type="button"
              onClick={onChangeProject}
              className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-medium text-gray-300
                         hover:bg-gray-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/40 transition-colors"
            >
              Changer de projet
            </button>
            <button
              type="button"
              onClick={onDisconnect}
              className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-medium text-gray-300
                         hover:bg-gray-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/40 transition-colors"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main id="main-content" className="mx-auto max-w-[1600px] px-6 py-8 lg:px-8">
        {/* Error banner */}
        {state.error && (
          <div role="alert" className="mb-6 rounded-lg border border-error-500/30 bg-error-100 p-4 text-sm text-error-500 font-medium flex items-start gap-2">
            <svg className="h-5 w-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{state.error}</span>
          </div>
        )}

        {/* Loading state */}
        {state.loading && (
          <div className="flex items-center justify-center py-20" role="status" aria-label="Chargement des KPIs">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" aria-hidden="true" />
            <span className="ml-3 text-gray-600 font-medium">Chargement…</span>
          </div>
        )}

        {!state.loading && (state.boardMode === 'kanban' || state.selectedSprintId !== null) && (
          <div className="space-y-6">
            {/* Période analysée (Kanban) */}
            {state.boardMode === 'kanban' && (
              <div className="rounded-lg border border-orange-500/20 bg-orange-50 px-4 py-3 text-sm text-gray-800">
                <span className="font-bold text-orange-600">Période :</span>{' '}
                <span className="font-medium">{kanbanStartDate} → {kanbanEndDate}</span>
              </div>
            )}

            {state.boardMode === 'scrum' && state.selectedSprintId !== null && (() => {
              const sprint = state.sprints.find((s) => s.id === state.selectedSprintId);
              const startDate = sprint?.startDate?.slice(0, 10) ?? '';
              const endDate = sprint?.endDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
              return (
                <KPIGrid
                  sprintId={state.selectedSprintId}
                  boardId={state.selectedBoardId}
                  projectKey={projectKey}
                  startDate={startDate}
                  endDate={endDate}
                />
              );
            })()}
            {state.boardMode === 'kanban' && (
              <KanbanKPIGrid
                projectKey={projectKey}
                startDate={kanbanStartDate}
                endDate={kanbanEndDate}
              />
            )}
          </div>
        )}

        {/* Empty state — Scrum only */}
        {!state.loading && state.boardMode === 'scrum' && state.sprints.length === 0 && !state.error && (
          <div className="py-20 text-center text-gray-600" role="status">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="font-medium">Aucun sprint disponible</p>
            <p className="text-sm text-gray-500 mt-1">Vérifiez la configuration du board Jira.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
