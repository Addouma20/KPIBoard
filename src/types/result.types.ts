// Result<T> pattern for async Jira operations
// Never throw directly - always return Result

export interface SuccessResult<T> {
  success: true;
  data: T;
}

export interface ErrorResult {
  success: false;
  error: JiraError;
}

export type Result<T> = SuccessResult<T> | ErrorResult;

export interface JiraError {
  code: JiraErrorCode;
  message: string;
  statusCode?: number;
  details?: unknown;
}

export const JIRA_ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVER_ERROR: 'SERVER_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  INVALID_CONFIG: 'INVALID_CONFIG',
  PARSE_ERROR: 'PARSE_ERROR',
} as const;

export type JiraErrorCode = (typeof JIRA_ERROR_CODES)[keyof typeof JIRA_ERROR_CODES];

export function success<T>(data: T): SuccessResult<T> {
  return { success: true, data };
}

export function failure(code: JiraErrorCode, message: string, statusCode?: number): ErrorResult {
  return { success: false, error: { code, message, statusCode } };
}

export function fromHttpStatus(statusCode: number, message: string): ErrorResult {
  const code: JiraErrorCode =
    statusCode === 401 ? 'UNAUTHORIZED' :
    statusCode === 403 ? 'FORBIDDEN' :
    statusCode === 404 ? 'NOT_FOUND' :
    statusCode === 429 ? 'RATE_LIMITED' :
    statusCode >= 500 ? 'SERVER_ERROR' :
    'NETWORK_ERROR';
  return failure(code, message, statusCode);
}
