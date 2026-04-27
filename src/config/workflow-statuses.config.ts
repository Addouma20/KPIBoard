import type { BugSeverity } from '../types';

// Status categories - configurable via .env overrides
// All lists are stored in lowercase for case-insensitive matching
function lowerList(envVar: string | undefined, defaults: string[]): string[] {
  const raw = envVar ? envVar.split(',').map(s => s.trim()) : defaults;
  return raw.map(s => s.toLowerCase());
}

export const DONE_STATUSES = lowerList(
  process.env.JIRA_DONE_STATUSES,
  ['done', 'closed', 'resolved', 'released', 'ready for delivery', 'terminé', 'terminée', 'fermé', 'clôturé', 'clôturée', 'prêt pour livraison']
);

export const IN_PROGRESS_STATUSES = lowerList(
  process.env.JIRA_IN_PROGRESS_STATUSES,
  ['in progress', 'in development', 'en cours', 'test in progress', 'prêt pour test']
);

export const TODO_STATUSES = lowerList(
  process.env.JIRA_TODO_STATUSES,
  ['to do', 'open', 'backlog', 'ready', 'draft', 'à faire', 'a faire']
);

export const READY_STATUSES = lowerList(
  process.env.JIRA_READY_STATUSES,
  ['ready', 'ready for dev', 'selected for development', 'ready for refinement', 'à faire', 'a faire', 'to do']
);

export const REVIEW_STATUSES = {
  inReview: lowerList(
    process.env.JIRA_REVIEW_STATUSES,
    ['in review', 'code review', 'peer review', 'à valider', 'a valider', 'en revue']
  ),
  changesRequested: lowerList(
    process.env.JIRA_CHANGES_REQUESTED_STATUSES,
    ['changes requested', 'rework', 'request changes']
  ),
  approved: ['approved', 'ready to merge', 'merge ready'],
};

export const BLOCKED_STATUSES = lowerList(
  process.env.JIRA_BLOCKED_STATUSES,
  ['blocked', 'on hold', 'waiting', 'en attente']
);

// Bug severity mapping from Jira priority names
export const BUG_SEVERITY_MAP: Record<string, BugSeverity> = {
  'Blocker': 'blocker',
  'Critical': 'critical',
  'Highest': 'blocker',
  'High': 'critical',
  'Major': 'major',
  'Medium': 'major',
  'Minor': 'minor',
  'Low': 'minor',
  'Lowest': 'minor',
};

export const BUG_SEVERITY_WEIGHTS: Record<BugSeverity, number> = {
  blocker: 3,
  critical: 3,
  major: 2,
  minor: 1,
};

export const BUG_RESOLVED_STATUSES = ['done', 'resolved', 'closed', 'fixed', "won't fix", 'clôturé', 'clôturée'];

export function isDoneStatus(status: string): boolean {
  return DONE_STATUSES.includes(status.toLowerCase());
}

export function isInProgressStatus(status: string): boolean {
  return IN_PROGRESS_STATUSES.includes(status.toLowerCase());
}

export function isReviewStatus(status: string): boolean {
  return REVIEW_STATUSES.inReview.includes(status.toLowerCase());
}

export function isBlockedStatus(status: string): boolean {
  return BLOCKED_STATUSES.includes(status.toLowerCase());
}

export function isReadyStatus(status: string): boolean {
  return READY_STATUSES.includes(status.toLowerCase());
}
