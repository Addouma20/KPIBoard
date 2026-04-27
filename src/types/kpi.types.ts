// KPI result types for all 4 EPICs

// --- EPIC-02: US Completion Rate ---

export interface USCompletionRateResult {
  sprintId: number;
  sprintName: string;
  totalUS: number;
  doneByWorkflow: number;
  doneManually: number;
  remaining: number;
  completionRatePercent: number;
  workflowRatePercent: number;
}

export interface SprintKPIPoint {
  sprintId: number;
  sprintName: string;
  endDate: string;
  completionRatePercent: number | null;
  workflowRatePercent: number | null;
  totalUS: number;
  doneUS: number;
}

// --- EPIC-03: MR Iterations ---

export interface ReviewTransition {
  from: string;
  to: string;
  date: string;
  author: string;
}

export interface MRIterationsResult {
  issueKey: string;
  iterationsCount: number | null;
  dataSource: 'custom_field' | 'status_transitions' | 'unavailable';
  reviewTransitions: ReviewTransition[];
}

export interface IterationDistribution {
  oneIteration: number;
  twoIterations: number;
  threeOrMore: number;
  unavailable: number;
}

export interface SprintMRIterationsResult {
  sprintId: number;
  sprintName: string;
  averageIterations: number | null;
  medianIterations: number | null;
  maxIterations: number | null;
  distribution: IterationDistribution;
  firstTimeRightPercent: number | null;
  issueDetails: MRIterationsResult[];
}

// --- EPIC-04: Lead / Cycle Time ---

export interface StatusPeriod {
  status: string;
  startDate: string;
  endDate: string | null;
  durationHours: number | null;
  isBusinessHours: boolean;
}

export interface CodeReviewDetail {
  reviewRound: number;
  startDate: string;
  endDate: string | null;
  durationHours: number | null;
  outcome: 'approved' | 'changes_requested' | 'in_progress';
}

export interface LeadCycleTimeResult {
  issueKey: string;
  summary: string;
  leadTimeHours: number | null;
  leadTimeBusinessDays: number | null;
  readyDate: string | null;
  doneDate: string | null;
  isWIP: boolean;
  cycleTimeHours: number | null;
  cycleDevTimeHours: number | null;
  pickupTimeHours: number | null;
  devActiveTimeHours: number | null;
  inProgressDate: string | null;
  reviewDate: string | null;
  activeTimeHours: number | null;
  waitTimeHours: number | null;
  codeReviewTimeHours: number | null;
  prOpenDate: string | null;
  prApprovedDate: string | null;
  codeReviewDetails: CodeReviewDetail[];
  statusHistory: StatusPeriod[];
  storyPoints: number | null;
}

export interface TimeStats {
  averageHours: number | null;
  medianHours: number | null;
  p85Hours: number | null;
  minHours: number | null;
  maxHours: number | null;
  sampleSize: number;
}

export interface SprintLeadCycleTimeResult {
  sprintId: number;
  sprintName: string;
  leadTime: TimeStats;
  cycleTime: TimeStats;
  cycleDevTime: TimeStats;
  pickupTime: TimeStats;
  devActiveTime: TimeStats;
  codeReviewTime: TimeStats;
  issueDetails: LeadCycleTimeResult[];
  wipCount: number;
}

export interface LeadCycleTimeOptions {
  businessDaysOnly: boolean;
  businessHoursStart: number;
  businessHoursEnd: number;
  timezone: string;
  readyStatuses: string[];
  doneStatuses: string[];
  inProgressStatuses: string[];
  reviewStatuses: string[];
  blockedStatuses: string[];
}

// --- EPIC-05: Bugs per US ---

export type BugSeverity = 'blocker' | 'critical' | 'major' | 'minor';
export type BugStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface BugDetail {
  key: string;
  summary: string;
  severity: BugSeverity;
  status: BugStatus;
  createdDate: string;
  resolvedDate: string | null;
  linkedUSKey: string;
  linkMethod: 'issue_link' | 'text_reference' | 'same_sprint_component' | 'subtask';
  weightedScore: number;
}

export interface USBugResult {
  issueKey: string;
  summary: string;
  totalBugs: number;
  activeBugs: number;
  resolvedBugs: number;
  bugs: BugDetail[];
  weightedBugScore: number;
  bugsBySeverity: {
    blocker: number;
    critical: number;
    major: number;
    minor: number;
  };
}

export interface SprintBugsResult {
  sprintId: number;
  sprintName: string;
  totalBugs: number;
  totalActiveBugs: number;
  totalResolvedBugs: number;
  bugsPerUSRatio: number | null;
  activeBugsPerUSRatio: number | null;
  topBuggyUS: USBugResult[];
  severityDistribution: {
    blocker: number;
    critical: number;
    major: number;
    minor: number;
  };
  issueDetails: USBugResult[];
}

export interface BugSprintHistoryPoint {
  sprintId: number;
  sprintName: string;
  endDate: string;
  totalBugs: number;
  activeBugs: number;
  bugsPerUSRatio: number | null;
  weightedScore: number;
}

export interface BugTrend {
  history: BugSprintHistoryPoint[];
  trend: 'improving' | 'stable' | 'degrading' | 'insufficient_data';
  trendPercent: number | null;
}

// --- Dashboard aggregate ---

export interface SprintKPIDashboard {
  sprintId: number;
  sprintName: string;
  exportDate: string;
  completionRate: USCompletionRateResult;
  mrIterations: SprintMRIterationsResult;
  leadCycleTime: SprintLeadCycleTimeResult;
  bugs: SprintBugsResult;
}

export interface USTableRow {
  key: string;
  summary: string;
  status: string;
  leadTimeDays: number | null;
  mrIterations: number | null;
  bugsCount: number;
  activeBugsCount: number;
  qualityScore: number;
  jiraUrl: string;
}

// --- Developer Ranking ---

export interface DevStats {
  displayName: string;
  usCount: number;
  usDone: number;
  totalStoryPoints: number | null;
  avgLeadTimeHours: number | null;
  avgCycleDevTimeHours: number | null;
  avgMRIterations: number | null;
  totalBugs: number;
  bugsPerUS: number | null;
  score: number;
}

export interface SprintDevRankingResult {
  sprintId: number;
  sprintName: string;
  developers: DevStats[];
}

// --- US Status Distribution ---

export interface StatusCount {
  status: string;
  category: 'done' | 'in_progress' | 'review' | 'todo' | 'blocked' | 'other';
  count: number;
}

export interface StatusDistributionResult {
  periodLabel: string;
  totalUS: number;
  statuses: StatusCount[];
  byCategoryCount: {
    done: number;
    in_progress: number;
    review: number;
    todo: number;
    blocked: number;
    other: number;
  };
}

// --- Kanban Trend (monthly) ---

export interface KanbanTrendPoint {
  monthLabel: string;
  startDate: string;
  endDate: string;
  completionRate: number | null;
  avgMRIterations: number | null;
  avgLeadTimeHours: number | null;
  avgCycleDevTimeHours: number | null;
  bugsPerUSRatio: number | null;
}

// --- First Time Right Rate ---

export interface FirstTimeRightResult {
  totalWithReview: number;
  approvedFirstTime: number;
  firstTimeRightPercent: number | null;
}

// --- Data Quality ---

export interface DataQuality {
  totalIssues: number;
  excludedOutliers: number;
  missingData: number;
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
}

// --- Insights ---

export type InsightSeverity = 'success' | 'info' | 'warning' | 'critical';

export interface Insight {
  id: string;
  severity: InsightSeverity;
  category: 'performance' | 'quality' | 'ai' | 'team' | 'trend';
  message: string;
  metric: string;
  value: number | null;
  delta: number | null;
}

// --- IA vs Non-IA Comparison ---

export interface IAComparisonMetrics {
  avgLeadTimeHours: number | null;
  avgCycleDevTimeHours: number | null;
  avgPickupTimeHours: number | null;
  avgDevActiveTimeHours: number | null;
  avgMRIterations: number | null;
  bugsPerUSRatio: number | null;
  firstTimeRightPercent: number | null;
  completionRatePercent: number | null;
  totalUS: number;
  avgStoryPoints: number | null;
}

export interface IAComparisonResult {
  periodLabel: string;
  ia: IAComparisonMetrics;
  nonIA: IAComparisonMetrics;
  deltas: {
    leadTimeDeltaPercent: number | null;
    cycleDevTimeDeltaPercent: number | null;
    pickupTimeDeltaPercent: number | null;
    devActiveTimeDeltaPercent: number | null;
    mrIterationsDeltaPercent: number | null;
    bugsPerUSDeltaPercent: number | null;
    firstTimeRightDeltaPercent: number | null;
  };
  insights: Insight[];
  dataQuality: DataQuality;
}

// --- Management ROI ---

export interface ROIMetrics {
  periodLabel: string;
  totalUS: number;
  iaUS: number;
  nonIAUS: number;
  iaAdoptionPercent: number;
  estimatedDaysSaved: number | null;
  avgCycleDevReductionPercent: number | null;
  avgLeadTimeReductionPercent: number | null;
  iaFirstTimeRightPercent: number | null;
  nonIAFirstTimeRightPercent: number | null;
}
