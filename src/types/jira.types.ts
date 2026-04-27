// Jira REST API v3 types

export interface JiraSprint {
  id: number;
  name: string;
  state: 'active' | 'closed' | 'future';
  startDate: string;
  endDate: string;
  completeDate?: string;
  goal?: string;
}

export interface JiraBoard {
  id: number;
  name: string;
  type: 'scrum' | 'kanban';
}

export interface JiraIssue {
  key: string;
  id: string;
  fields: JiraIssueFields;
  changelog?: JiraChangelog;
}

export interface JiraIssueFields {
  summary: string;
  status: JiraStatus;
  issuetype: JiraIssueType;
  priority: JiraPriority;
  assignee: JiraUser | null;
  created: string;
  resolutiondate: string | null;
  labels: string[];
  components: JiraComponent[];
  issuelinks: JiraIssueLink[];
  subtasks: JiraSubtask[];
  description: string | null;
  story_points: number | null;
  // Custom fields for MR iterations
  [key: string]: unknown;
}

export interface JiraStatus {
  name: string;
  id: string;
  statusCategory: {
    key: string;
    name: string;
  };
}

export interface JiraIssueType {
  name: string;
  id: string;
  subtask: boolean;
}

export interface JiraPriority {
  name: string;
  id: string;
}

export interface JiraUser {
  displayName: string;
  name: string;
  emailAddress?: string;
  accountId?: string;
}

export interface JiraComponent {
  id: string;
  name: string;
}

export interface JiraIssueLink {
  id: string;
  type: {
    name: string;
    inward: string;
    outward: string;
  };
  inwardIssue?: JiraLinkedIssue;
  outwardIssue?: JiraLinkedIssue;
}

export interface JiraLinkedIssue {
  key: string;
  fields: {
    summary: string;
    status: JiraStatus;
    issuetype: JiraIssueType;
    priority: JiraPriority;
  };
}

export interface JiraSubtask {
  key: string;
  fields: {
    summary: string;
    status: JiraStatus;
    issuetype: JiraIssueType;
  };
}

export interface JiraChangelog {
  histories: JiraChangelogHistory[];
}

export interface JiraChangelogHistory {
  id: string;
  created: string;
  author: JiraUser;
  items: JiraChangelogItem[];
}

export interface JiraChangelogItem {
  field: string;
  fieldtype: string;
  from: string | null;
  fromString: string | null;
  to: string | null;
  toString: string | null;
}

export interface JiraComment {
  id: string;
  body: string;
  created: string;
  author: JiraUser;
}

export interface JiraCommentResponse {
  startAt: number;
  maxResults: number;
  total: number;
  comments: JiraComment[];
}

export interface JiraSearchResult {
  startAt: number;
  maxResults: number;
  total: number;
  issues: JiraIssue[];
}

export interface JiraBoardResult {
  values: JiraBoard[];
}

export interface JiraSprintResult {
  values: JiraSprint[];
}

// Excluded issue types for KPI calculations
const EXCLUDED_ISSUE_TYPES_LOWER = ['bug', 'bogue', 'sub-task', 'sous-tache', 'sous-tâche', 'epopée', 'epic'] as const;

export function isExcludedIssueType(typeName: string): boolean {
  return (EXCLUDED_ISSUE_TYPES_LOWER as readonly string[]).includes(typeName.toLowerCase());
}

export function isUserStory(issue: JiraIssue): boolean {
  return !isExcludedIssueType(issue.fields.issuetype.name) && !issue.fields.issuetype.subtask;
}
