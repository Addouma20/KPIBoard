import { Router, Request, Response, NextFunction } from 'express';
import { JiraClient, getJiraClient, hasJiraClient } from '../clients/jira-client';
import { calculateUSCompletionRate, getSprintHistory } from '../kpi/us-completion-rate.kpi';
import { calculateMRIterations, calculateSprintMRIterations } from '../kpi/mr-iterations.kpi';
import { calculateLeadCycleTime, calculateSprintLeadCycleTime } from '../kpi/lead-cycle-time.kpi';
import { getBugsForIssue, calculateSprintBugs } from '../kpi/bugs-per-us.kpi';
import { calculateSprintDevRanking } from '../kpi/dev-ranking.kpi';
import { calculateKanbanAllKPIs, calculateKanbanDevRanking } from '../kpi/kanban-kpi';
import { calculateStatusDistribution, calculateKanbanStatusDistribution } from '../kpi/status-distribution.kpi';
import { calculateKanbanTrend } from '../kpi/kanban-trend.kpi';
import { isUserStory } from '../types/jira.types';
import type { Result } from '../types';

const router = Router();

// Auth guard — all KPI routes require an active Jira connection
router.use((_req: Request, res: Response, next: NextFunction) => {
  if (!hasJiraClient()) {
    res.status(401).json({ error: 'Non connecté' });
    return;
  }
  next();
});

function getClient(): JiraClient {
  return getJiraClient();
}

function sendResult<T>(res: Response, result: Result<T>): void {
  if (result.success) {
    res.json(result.data);
  } else {
    const statusMap: Record<string, number> = {
      UNAUTHORIZED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      RATE_LIMITED: 429,
      SERVER_ERROR: 503,
      NETWORK_ERROR: 502,
      INVALID_CONFIG: 500,
      PARSE_ERROR: 500,
    };
    const httpStatus = statusMap[result.error.code] ?? 500;
    res.status(httpStatus).json({ error: result.error });
  }
}

function requireSprintId(req: Request, res: Response): number | null {
  const sprintId = Number(req.query.sprintId);
  if (!sprintId || isNaN(sprintId)) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'sprintId query parameter is required' } });
    return null;
  }
  return sprintId;
}

// --- EPIC-02: Completion Rate ---

router.get('/completion-rate', async (req: Request, res: Response) => {
  const sprintId = requireSprintId(req, res);
  if (sprintId === null) return;

  const client = getClient();
  const serviceAccount = client.getConfig().workflowServiceAccount;
  const result = await calculateUSCompletionRate(client, sprintId, serviceAccount);
  sendResult(res, result);
});

router.get('/completion-rate/history', async (req: Request, res: Response) => {
  const boardId = Number(req.query.boardId);
  if (!boardId || isNaN(boardId)) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'boardId query parameter is required' } });
    return;
  }
  const last = Number(req.query.last) || 5;
  const client = getClient();
  const serviceAccount = client.getConfig().workflowServiceAccount;
  const result = await getSprintHistory(client, boardId, last, serviceAccount);
  sendResult(res, result);
});

// --- EPIC-03: MR Iterations ---

router.get('/mr-iterations', async (req: Request, res: Response) => {
  const sprintId = requireSprintId(req, res);
  if (sprintId === null) return;

  const result = await calculateSprintMRIterations(getClient(), sprintId);
  sendResult(res, result);
});

router.get('/mr-iterations/issue', async (req: Request, res: Response) => {
  const issueKey = req.query.issueKey as string | undefined;
  if (!issueKey) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'issueKey query parameter is required' } });
    return;
  }
  const result = await calculateMRIterations(getClient(), issueKey);
  sendResult(res, result);
});

// --- EPIC-04: Lead / Cycle Time ---

router.get('/lead-cycle-time', async (req: Request, res: Response) => {
  const sprintId = requireSprintId(req, res);
  if (sprintId === null) return;

  const result = await calculateSprintLeadCycleTime(getClient(), sprintId);
  sendResult(res, result);
});

router.get('/lead-cycle-time/issue', async (req: Request, res: Response) => {
  const issueKey = req.query.issueKey as string | undefined;
  if (!issueKey) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'issueKey query parameter is required' } });
    return;
  }
  const result = await calculateLeadCycleTime(getClient(), issueKey);
  sendResult(res, result);
});

// --- EPIC-05: Bugs per US ---

router.get('/bugs', async (req: Request, res: Response) => {
  const sprintId = requireSprintId(req, res);
  if (sprintId === null) return;

  const result = await calculateSprintBugs(getClient(), sprintId);
  sendResult(res, result);
});

router.get('/bugs/issue', async (req: Request, res: Response) => {
  const issueKey = req.query.issueKey as string | undefined;
  const sprintId = Number(req.query.sprintId);
  if (!issueKey) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'issueKey query parameter is required' } });
    return;
  }
  if (!sprintId || isNaN(sprintId)) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'sprintId query parameter is required' } });
    return;
  }
  const result = await getBugsForIssue(getClient(), issueKey, sprintId);
  sendResult(res, result);
});

// --- Aggregate: all KPIs for a sprint ---

router.get('/all', async (req: Request, res: Response) => {
  const sprintId = requireSprintId(req, res);
  if (sprintId === null) return;

  const client = getClient();
  const serviceAccount = client.getConfig().workflowServiceAccount;

  const [completionRate, mrIterations, leadCycleTime, bugs] = await Promise.all([
    calculateUSCompletionRate(client, sprintId, serviceAccount),
    calculateSprintMRIterations(client, sprintId),
    calculateSprintLeadCycleTime(client, sprintId),
    calculateSprintBugs(client, sprintId),
  ]);

  res.json({
    sprintId,
    exportDate: new Date().toISOString(),
    completionRate: completionRate.success ? completionRate.data : null,
    mrIterations: mrIterations.success ? mrIterations.data : null,
    leadCycleTime: leadCycleTime.success ? leadCycleTime.data : null,
    bugs: bugs.success ? bugs.data : null,
    errors: [
      ...(!completionRate.success ? [{ kpi: 'completion-rate', error: completionRate.error }] : []),
      ...(!mrIterations.success ? [{ kpi: 'mr-iterations', error: mrIterations.error }] : []),
      ...(!leadCycleTime.success ? [{ kpi: 'lead-cycle-time', error: leadCycleTime.error }] : []),
      ...(!bugs.success ? [{ kpi: 'bugs', error: bugs.error }] : []),
    ],
  });
});

// --- Trend: KPIs across last N sprints ---

router.get('/trend', async (req: Request, res: Response) => {
  const boardId = Number(req.query.boardId);
  if (!boardId || isNaN(boardId)) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'boardId query parameter is required' } });
    return;
  }
  const last = Math.min(Number(req.query.last) || 10, 20);

  const client = getClient();
  const serviceAccount = client.getConfig().workflowServiceAccount;

  const sprintsResult = await client.getSprints(boardId, 'active,closed');
  if (!sprintsResult.success) {
    res.status(502).json({ error: sprintsResult.error });
    return;
  }

  // Take last N closed/active sprints (most recent first → reverse for chronological order)
  const sprints = sprintsResult.data.slice(-last);

  const points = await Promise.all(
    sprints.map(async (sprint) => {
      const [cr, mr, lct, bugs] = await Promise.all([
        calculateUSCompletionRate(client, sprint.id, serviceAccount),
        calculateSprintMRIterations(client, sprint.id),
        calculateSprintLeadCycleTime(client, sprint.id),
        calculateSprintBugs(client, sprint.id),
      ]);

      return {
        sprintId: sprint.id,
        sprintName: sprint.name,
        completionRate: cr.success ? cr.data.completionRatePercent : null,
        avgMRIterations: mr.success ? mr.data.averageIterations : null,
        avgLeadTimeHours: lct.success ? lct.data.leadTime.averageHours : null,
        avgCycleDevTimeHours: lct.success ? lct.data.cycleDevTime.averageHours : null,
        bugsPerUSRatio: bugs.success ? bugs.data.bugsPerUSRatio : null,
      };
    }),
  );

  res.json(points);
});

// --- Developer Ranking ---

router.get('/dev-ranking', async (req: Request, res: Response) => {
  const sprintId = requireSprintId(req, res);
  if (sprintId === null) return;

  const result = await calculateSprintDevRanking(getClient(), sprintId);
  sendResult(res, result);
});

// ======================================================================
// KANBAN ROUTES
// ======================================================================

function requireDateRange(req: Request, res: Response): { projectKey: string; startDate: string; endDate: string } | null {
  const projectKey = req.query.projectKey as string | undefined;
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;

  if (!projectKey || !startDate || !endDate) {
    res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'projectKey, startDate and endDate query parameters are required' },
    });
    return null;
  }

  // Basic date format validation (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'Dates must be in YYYY-MM-DD format' },
    });
    return null;
  }

  return { projectKey, startDate, endDate };
}

// --- Kanban: all KPIs for a date range ---

router.get('/all-kanban', async (req: Request, res: Response) => {
  const params = requireDateRange(req, res);
  if (!params) return;

  const result = await calculateKanbanAllKPIs(
    getClient(),
    params.projectKey,
    params.startDate,
    params.endDate,
  );
  sendResult(res, result);
});

// --- Kanban: developer ranking for a date range ---

router.get('/dev-ranking-kanban', async (req: Request, res: Response) => {
  const params = requireDateRange(req, res);
  if (!params) return;

  const client = getClient();
  const issuesResult = await client.getKanbanIssues(params.projectKey, params.startDate, params.endDate);
  if (!issuesResult.success) {
    sendResult(res, issuesResult);
    return;
  }

  const allIssues = issuesResult.data;
  const stories = allIssues.filter(isUserStory);
  const periodLabel = `${params.startDate} → ${params.endDate}`;

  const result = await calculateKanbanDevRanking(client, stories, allIssues, periodLabel);
  sendResult(res, result);
});

// --- AI Agent KPIs (sprint or kanban mode) ---

router.get('/ai-agent', async (req: Request, res: Response) => {
  const client = getClient();
  const sprintIdRaw = req.query.sprintId as string | undefined;

  let issuesResult;
  let periodLabel: string;

  if (sprintIdRaw) {
    // Scrum mode
    const sprintId = Number(sprintIdRaw);
    if (!sprintId || isNaN(sprintId)) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'sprintId must be a number' } });
      return;
    }
    issuesResult = await client.getAIAgentIssues({ sprintId });
    periodLabel = `Sprint ${sprintId} — Agent IA`;
  } else {
    // Kanban mode
    const params = requireDateRange(req, res);
    if (!params) return;
    issuesResult = await client.getAIAgentIssues({ projectKey: params.projectKey, startDate: params.startDate, endDate: params.endDate });
    periodLabel = `${params.startDate} → ${params.endDate} — Agent IA`;
  }

  if (!issuesResult.success) {
    sendResult(res, issuesResult);
    return;
  }

  const allIssues = issuesResult.data;
  const result = await calculateKanbanAllKPIs(client, '', '', '', allIssues, periodLabel, true);
  sendResult(res, result);
});

// --- Status Distribution (Scrum) ---

router.get('/status-distribution', async (req: Request, res: Response) => {
  const sprintId = requireSprintId(req, res);
  if (sprintId === null) return;

  const result = await calculateStatusDistribution(getClient(), sprintId);
  sendResult(res, result);
});

// --- Status Distribution (Kanban) ---

router.get('/status-distribution-kanban', async (req: Request, res: Response) => {
  const params = requireDateRange(req, res);
  if (!params) return;

  const result = await calculateKanbanStatusDistribution(
    getClient(),
    params.projectKey,
    params.startDate,
    params.endDate,
  );
  sendResult(res, result);
});

// --- Kanban Trend (monthly KPIs) ---

router.get('/trend-kanban', async (req: Request, res: Response) => {
  const projectKey = req.query.projectKey as string | undefined;
  if (!projectKey) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'projectKey query parameter is required' } });
    return;
  }
  const months = Math.min(Number(req.query.months) || 6, 12);

  const result = await calculateKanbanTrend(getClient(), projectKey, months);
  sendResult(res, result);
});

// --- Cache invalidation ---

router.post('/invalidate-cache', (_req: Request, res: Response) => {
  getClient().invalidateCache();
  res.json({ message: 'Cache invalidated' });
});

export default router;
