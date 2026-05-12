import express from 'express';
import cors from 'cors';
import kpiRoutes from './api/kpi.routes';
import { JiraClient, getJiraClient, resetJiraClient, hasJiraClient } from './clients/jira-client';
import type { JiraConfig } from './config/jira.config';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());

// --- Auth routes ---

app.post('/api/auth/connect', async (req, res) => {
  const { token } = req.body as { token?: string };
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    res.status(400).json({ error: 'Token requis' });
    return;
  }

  const config: JiraConfig = {
    baseUrl: process.env.JIRA_URL ?? 'https://portail.agir.orange.com',
    email: process.env.JIRA_EMAIL ?? 'user@orange.com',
    token: token.trim(),
    projectKey: process.env.JIRA_PROJECT_KEY ?? 'CONTRASTE',
    cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS ?? '300'),
    workflowServiceAccount: process.env.WORKFLOW_SERVICE_ACCOUNT ?? 'workflow-bot',
    iterationsCustomField: process.env.JIRA_ITERATIONS_FIELD ?? 'customfield_10020',
  };

  const client = getJiraClient(config);
  const result = await client.validateConnection();
  if (!result.success) {
    console.error('[Auth] Connection failed:', result.error);
    resetJiraClient();
    res.status(401).json({ error: 'Token invalide ou connexion échouée', details: result.error });
    return;
  }

  console.log('[Auth] Connected as:', result.data.displayName);
  res.json({ user: result.data.displayName });
});

app.get('/api/auth/projects', async (_req, res) => {
  if (!hasJiraClient()) {
    res.status(401).json({ error: 'Non connecté' });
    return;
  }

  const client = getJiraClient();
  const result = await client.getProjects();
  if (!result.success) {
    res.status(502).json({ error: result.error });
    return;
  }

  const projects = result.data.map((p) => ({ key: p.key, name: p.name, id: p.id }));
  res.json(projects);
});

app.post('/api/auth/select-project', async (req, res) => {
  const { projectKey } = req.body as { projectKey?: string };
  if (!projectKey || typeof projectKey !== 'string') {
    res.status(400).json({ error: 'projectKey requis' });
    return;
  }

  if (!hasJiraClient()) {
    res.status(401).json({ error: 'Non connecté' });
    return;
  }

  const client = getJiraClient();
  client.setProjectKey(projectKey);
  client.invalidateCache();
  res.json({ projectKey });
});

app.get('/api/auth/status', async (_req, res) => {
  // Already connected — return current projectKey so the frontend can restore state
  if (hasJiraClient()) {
    const client = getJiraClient();
    res.json({ connected: true, projectKey: client.getProjectKey() });
    return;
  }

  // Auto-connect using env variables if available
  const envToken = process.env.JIRA_TOKEN;
  if (envToken && envToken !== 'your-jira-api-token') {
    const config: JiraConfig = {
      baseUrl: process.env.JIRA_URL ?? 'https://portail.agir.orange.com',
      email: process.env.JIRA_EMAIL ?? 'user@orange.com',
      token: envToken,
      projectKey: process.env.JIRA_PROJECT_KEY ?? 'CONTRASTE',
      cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS ?? '300'),
      workflowServiceAccount: process.env.WORKFLOW_SERVICE_ACCOUNT ?? 'workflow-bot',
      iterationsCustomField: process.env.JIRA_ITERATIONS_FIELD ?? 'customfield_10020',
    };

    const client = getJiraClient(config);
    const result = await client.validateConnection();
    if (result.success) {
      console.log('[Auth] Auto-connected via env token as:', result.data.displayName);
      res.json({ connected: true, user: result.data.displayName, projectKey: client.getProjectKey() });
      return;
    }
    resetJiraClient();
  }

  res.json({ connected: false });
});

// Jira proxy routes for the frontend (boards + sprints)
app.get('/api/kpi/boards', async (_req, res) => {
  if (!hasJiraClient()) { res.status(401).json({ error: 'Non connecté' }); return; }
  const client = getJiraClient();
  const result = await client.getBoards();
  if (result.success) {
    res.json(result.data);
  } else {
    console.error('[/api/kpi/boards] Jira error:', JSON.stringify(result.error));
    res.status(502).json({ error: result.error });
  }
});

app.get('/api/kpi/sprints', async (req, res) => {
  if (!hasJiraClient()) { res.status(401).json({ error: 'Non connecté' }); return; }
  const boardId = Number(req.query.boardId);
  if (!boardId || isNaN(boardId)) {
    res.status(400).json({ error: 'boardId required' });
    return;
  }
  const state = (req.query.state as string) || undefined;
  const client = getJiraClient();
  const result = await client.getSprints(boardId, state);
  if (result.success) {
    res.json(result.data);
  } else {
    console.error('[/api/kpi/sprints] Jira error:', JSON.stringify(result.error));
    res.status(502).json({ error: result.error });
  }
});

// KPI routes
app.use('/api/kpi', kpiRoutes);

app.listen(PORT, () => {
  console.log(`[KPI Server] Running on http://localhost:${PORT}`);
  console.log(`[KPI Server] Waiting for token connection...`);
});
