import { z } from 'zod';

const jiraConfigSchema = z.object({
  baseUrl: z.string().url(),
  email: z.string().email(),
  token: z.string().min(1),
  projectKey: z.string().min(1),
  cacheTtlSeconds: z.number().int().positive().default(300),
  workflowServiceAccount: z.string().default('workflow-bot'),
  iterationsCustomField: z.string().default('customfield_10020'),
});

export type JiraConfig = z.infer<typeof jiraConfigSchema>;

export function loadJiraConfig(): JiraConfig {
  const raw = {
    baseUrl: process.env.JIRA_URL ?? 'https://portail.agir.orange.com',
    email: process.env.JIRA_EMAIL ?? '',
    token: process.env.JIRA_TOKEN ?? '',
    projectKey: process.env.JIRA_PROJECT_KEY ?? 'CONTRASTE',
    cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS ?? '300'),
    workflowServiceAccount: process.env.WORKFLOW_SERVICE_ACCOUNT ?? 'workflow-bot',
    iterationsCustomField: process.env.JIRA_ITERATIONS_FIELD ?? 'customfield_10020',
  };

  return jiraConfigSchema.parse(raw);
}
