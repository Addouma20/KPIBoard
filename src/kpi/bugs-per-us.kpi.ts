import type {
  JiraIssue,
  BugDetail,
  USBugResult,
  SprintBugsResult,
  BugSeverity,
  BugStatus,
} from '../types';
import { success, failure } from '../types/result.types';
import type { Result } from '../types/result.types';
import { JiraClient } from '../clients/jira-client';
import { isUserStory } from '../types/jira.types';
import {
  BUG_SEVERITY_MAP,
  BUG_SEVERITY_WEIGHTS,
  BUG_RESOLVED_STATUSES,
  isDoneStatus,
} from '../config/workflow-statuses.config';

export function mapBugSeverity(priorityName: string): BugSeverity {
  // Case-insensitive lookup
  const lower = priorityName.toLowerCase();
  for (const [key, value] of Object.entries(BUG_SEVERITY_MAP)) {
    if (key.toLowerCase() === lower) return value;
  }
  return 'minor';
}

export function mapBugStatus(statusName: string): BugStatus {
  const lower = statusName.toLowerCase();
  if (BUG_RESOLVED_STATUSES.includes(lower)) {
    return lower.includes('closed') || lower.includes('clôtur') ? 'closed' : 'resolved';
  }
  if (lower.includes('progress') || lower.includes('cours')) {
    return 'in_progress';
  }
  return 'open';
}

function isBugType(typeName: string): boolean {
  const lower = typeName.toLowerCase();
  return lower === 'bug' || lower === 'bogue';
}

function buildBugDetail(
  key: string,
  summary: string,
  priorityName: string,
  statusName: string,
  createdDate: string,
  resolvedDate: string | null,
  linkedUSKey: string,
  linkMethod: BugDetail['linkMethod'],
): BugDetail {
  const severity = mapBugSeverity(priorityName);
  return {
    key,
    summary,
    severity,
    status: mapBugStatus(statusName),
    createdDate,
    resolvedDate,
    linkedUSKey,
    linkMethod,
    weightedScore: BUG_SEVERITY_WEIGHTS[severity],
  };
}

const LINK_METHOD_PRIORITY: Record<BugDetail['linkMethod'], number> = {
  issue_link: 0,
  text_reference: 1,
  same_sprint_component: 2,
  subtask: 3,
};

function deduplicateBugs(bugs: BugDetail[]): BugDetail[] {
  const map = new Map<string, BugDetail>();
  for (const bug of bugs) {
    const existing = map.get(bug.key);
    if (!existing || LINK_METHOD_PRIORITY[bug.linkMethod] < LINK_METHOD_PRIORITY[existing.linkMethod]) {
      map.set(bug.key, bug);
    }
  }
  return Array.from(map.values());
}

export async function getBugsForIssue(
  jiraClient: JiraClient,
  issueKey: string,
  sprintId: number,
): Promise<Result<BugDetail[]>> {
  const bugs: BugDetail[] = [];

  // 1. Issue links
  const issueResult = await jiraClient.getIssueWithChangelog(issueKey);
  if (!issueResult.success) return issueResult;

  const issue = issueResult.data;

  for (const link of issue.fields.issuelinks) {
    const linked = link.inwardIssue ?? link.outwardIssue;
    if (linked && isBugType(linked.fields.issuetype.name)) {
      bugs.push(
        buildBugDetail(
          linked.key,
          linked.fields.summary,
          linked.fields.priority.name,
          linked.fields.status.name,
          '', // created date not available in linked issue summary
          null,
          issueKey,
          'issue_link',
        ),
      );
    }
  }

  // 2. Text reference search
  const textJql = `issuetype = Bug AND (description ~ "${issueKey}" OR summary ~ "${issueKey}")`;
  const textResult = await jiraClient.searchIssues(textJql, [
    'summary', 'status', 'issuetype', 'priority', 'created', 'resolutiondate',
  ]);
  if (!textResult.success) return textResult;

  for (const bugIssue of textResult.data) {
    bugs.push(
      buildBugDetail(
        bugIssue.key,
        bugIssue.fields.summary,
        bugIssue.fields.priority.name,
        bugIssue.fields.status.name,
        bugIssue.fields.created,
        bugIssue.fields.resolutiondate,
        issueKey,
        'text_reference',
      ),
    );
  }

  // 3. Same sprint + component
  const components = issue.fields.components;
  if (components.length > 0) {
    const componentNames = components.map(c => `"${c.name}"`).join(', ');
    const compJql = `issuetype = Bug AND sprint = ${sprintId} AND component in (${componentNames})`;
    const compResult = await jiraClient.searchIssues(compJql, [
      'summary', 'status', 'issuetype', 'priority', 'created', 'resolutiondate',
    ]);
    if (!compResult.success) return compResult;

    for (const bugIssue of compResult.data) {
      bugs.push(
        buildBugDetail(
          bugIssue.key,
          bugIssue.fields.summary,
          bugIssue.fields.priority.name,
          bugIssue.fields.status.name,
          bugIssue.fields.created,
          bugIssue.fields.resolutiondate,
          issueKey,
          'same_sprint_component',
        ),
      );
    }
  }

  // 4. Subtasks of type Bug
  for (const subtask of issue.fields.subtasks) {
    if (isBugType(subtask.fields.issuetype.name)) {
      bugs.push(
        buildBugDetail(
          subtask.key,
          subtask.fields.summary,
          'Minor', // subtasks don't carry priority in the summary view
          subtask.fields.status.name,
          '',
          null,
          issueKey,
          'subtask',
        ),
      );
    }
  }

  // 5. Deduplicate
  return success(deduplicateBugs(bugs));
}

function buildUSBugResult(issueKey: string, summary: string, bugs: BugDetail[]): USBugResult {
  const activeBugs = bugs.filter(b => b.status === 'open' || b.status === 'in_progress').length;
  const resolvedBugs = bugs.filter(b => b.status === 'resolved' || b.status === 'closed').length;

  const bugsBySeverity = { blocker: 0, critical: 0, major: 0, minor: 0 };
  let weightedBugScore = 0;
  for (const bug of bugs) {
    bugsBySeverity[bug.severity]++;
    weightedBugScore += bug.weightedScore;
  }

  return {
    issueKey,
    summary,
    totalBugs: bugs.length,
    activeBugs,
    resolvedBugs,
    bugs,
    weightedBugScore,
    bugsBySeverity,
  };
}

export async function calculateSprintBugs(
  jiraClient: JiraClient,
  sprintId: number,
): Promise<Result<SprintBugsResult>> {
  const sprintsResult = await jiraClient.getSprintIssues(sprintId);
  if (!sprintsResult.success) return sprintsResult;

  const allIssues = sprintsResult.data;
  const userStories = allIssues.filter(isUserStory);
  const sprintBugs = allIssues.filter(i => isBugType(i.fields.issuetype.name));

  // Build bug details for each US from already-loaded data (no extra API calls)
  const issueDetails: USBugResult[] = [];

  for (const us of userStories) {
    const bugs: BugDetail[] = [];

    // From issuelinks on the already-loaded US
    for (const link of us.fields.issuelinks) {
      const linked = link.inwardIssue ?? link.outwardIssue;
      if (linked && isBugType(linked.fields.issuetype.name)) {
        bugs.push(
          buildBugDetail(
            linked.key,
            linked.fields.summary,
            linked.fields.priority.name,
            linked.fields.status.name,
            '',
            null,
            us.key,
            'issue_link',
          ),
        );
      }
    }

    // From subtasks
    for (const subtask of us.fields.subtasks) {
      if (isBugType(subtask.fields.issuetype.name)) {
        bugs.push(
          buildBugDetail(
            subtask.key,
            subtask.fields.summary,
            'Minor',
            subtask.fields.status.name,
            '',
            null,
            us.key,
            'subtask',
          ),
        );
      }
    }

    // From sprint bugs matching same component
    const usComponents = new Set(us.fields.components.map(c => c.name));
    if (usComponents.size > 0) {
      for (const bug of sprintBugs) {
        const bugComponents = bug.fields.components.map(c => c.name);
        const hasCommonComponent = bugComponents.some(c => usComponents.has(c));
        if (hasCommonComponent) {
          bugs.push(
            buildBugDetail(
              bug.key,
              bug.fields.summary,
              bug.fields.priority.name,
              bug.fields.status.name,
              bug.fields.created,
              bug.fields.resolutiondate,
              us.key,
              'same_sprint_component',
            ),
          );
        }
      }
    }

    const dedupedBugs = deduplicateBugs(bugs);
    issueDetails.push(buildUSBugResult(us.key, us.fields.summary, dedupedBugs));
  }

  // Aggregation
  let totalBugs = 0;
  let totalActiveBugs = 0;
  let totalResolvedBugs = 0;
  const severityDistribution = { blocker: 0, critical: 0, major: 0, minor: 0 };

  for (const detail of issueDetails) {
    totalBugs += detail.totalBugs;
    totalActiveBugs += detail.activeBugs;
    totalResolvedBugs += detail.resolvedBugs;
    severityDistribution.blocker += detail.bugsBySeverity.blocker;
    severityDistribution.critical += detail.bugsBySeverity.critical;
    severityDistribution.major += detail.bugsBySeverity.major;
    severityDistribution.minor += detail.bugsBySeverity.minor;
  }

  const totalUSCount = userStories.length;
  const bugsPerUSRatio = totalUSCount > 0 ? totalBugs / totalUSCount : null;
  const activeBugsPerUSRatio = totalUSCount > 0 ? totalActiveBugs / totalUSCount : null;

  // Top 5 buggiest US
  const topBuggyUS = [...issueDetails]
    .sort((a, b) => b.totalBugs - a.totalBugs)
    .slice(0, 5);

  // Sprint name — retrieve from the first sprint reference or use ID
  const sprintName = `Sprint ${sprintId}`;

  return success({
    sprintId,
    sprintName,
    totalBugs,
    totalActiveBugs,
    totalResolvedBugs,
    bugsPerUSRatio,
    activeBugsPerUSRatio,
    topBuggyUS,
    severityDistribution,
    issueDetails,
  });
}
