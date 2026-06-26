// ============================================================
// MCP Code Review Tool - Core Type Definitions
// ============================================================

/**
 * Issue severity levels for review findings.
 */
export type IssueSeverity = 'critical' | 'warning' | 'info';

/**
 * Categorization of review issues for better analysis grouping.
 * Using a union of string literals (not an enum) for TypeScript best practices.
 */
export type IssueCategory =
  | 'security'
  | 'performance'
  | 'bug'
  | 'code_style'
  | 'best_practice'
  | 'maintainability'
  | 'potential_error'
  | 'type_safety'
  | 'logic_error';

/**
 * Supported output formats for review reports.
 */
export type ReportFormat = 'markdown' | 'terminal' | 'json' | 'html';

/**
 * Status of a file in a git diff.
 */
export type DiffFileStatus = 'added' | 'modified' | 'deleted' | 'renamed';

/**
 * Supported LLM provider types for the review agent.
 */
export type ModelProvider = 'openai' | 'anthropic' | 'custom';

/**
 * Configuration for the code review tool.
 */
export interface ReviewConfig {
  /** LLM provider to use */
  modelProvider: ModelProvider;
  /** Model name/identifier */
  modelName: string;
  /** API key for the LLM provider */
  apiKey: string;
  /** Custom API base URL (for custom providers or proxies) */
  apiBaseUrl?: string;
  /** Temperature for LLM generation (0.0 - 2.0) */
  temperature?: number;
  /** Maximum tokens for LLM response */
  maxTokens?: number;
  /** Additional system instructions to append */
  customInstructions?: string;
  /** Files or patterns to exclude from review */
  excludePatterns?: string[];
}

/**
 * Represents a single hunk in a git diff.
 */
export interface DiffHunk {
  /** Diff hunk header (e.g., "@@ -1,3 +1,4 @@") */
  header: string;
  /** Starting line number in the old file */
  oldStart: number;
  /** Number of lines in the old file hunk */
  oldLines: number;
  /** Starting line number in the new file */
  newStart: number;
  /** Number of lines in the new file hunk */
  newLines: number;
  /** Raw content of the hunk */
  content: string;
}

/**
 * Represents a single file change from a git diff.
 */
export interface DiffFile {
  /** File path */
  path: string;
  /** Change status */
  status: DiffFileStatus;
  /** Previous path (for renamed files) */
  oldPath?: string;
  /** Number of added lines */
  additions: number;
  /** Number of deleted lines */
  deletions: number;
  /** Hunks in the diff */
  hunks: DiffHunk[];
}

/**
 * Represents a single issue found during code review.
 */
export interface ReviewIssue {
  /** Severity level */
  severity: IssueSeverity;
  /** Issue category */
  category: IssueCategory;
  /** File where the issue was found */
  file: string;
  /** Line number (if applicable) */
  line?: number;
  /** Column number (if applicable) */
  column?: number;
  /** Description of the issue */
  message: string;
  /** Suggested fix or improvement */
  suggestion: string;
  /** Optional rule identifier */
  ruleId?: string;
}

/**
 * Summary statistics for a code review.
 */
export interface ReviewSummary {
  /** Total number of issues found */
  totalIssues: number;
  /** Count of critical issues */
  criticalCount: number;
  /** Count of warning-level issues */
  warningCount: number;
  /** Count of info-level items */
  infoCount: number;
  /** Breakdown by category */
  categories: Partial<Record<IssueCategory, number>>;
  /** Number of files reviewed */
  filesReviewed: number;
  /** Total lines of code reviewed */
  totalLines: number;
  /** Overall code quality score (0-100) */
  overallScore: number;
  /** Duration of the review in milliseconds */
  durationMs: number;
}

/**
 * A complete code review result.
 */
export interface CodeReview {
  /** Unique review identifier */
  id: string;
  /** ISO timestamp of when the review was performed */
  timestamp: string;
  /** Configuration used for this review */
  config: ReviewConfig;
  /** Files included in the review */
  files: string[];
  /** Parsed git diff data */
  diff: DiffFile[];
  /** Issues found during review */
  issues: ReviewIssue[];
  /** Summary statistics */
  summary: ReviewSummary;
  /** Overall review explanation/commentary */
  explanation: string;
}

/**
 * A suggested fix for a code issue.
 */
export interface FixSuggestion {
  /** File to modify */
  file: string;
  /** Starting line number */
  line?: number;
  /** Original code that should be replaced */
  original: string;
  /** Suggested replacement code */
  suggested: string;
  /** Reasoning behind the suggestion */
  reasoning: string;
}

/**
 * Result from the code analyzer layer.
 */
export interface AnalysisResult {
  /** Parsed diff files */
  diffFiles: DiffFile[];
  /** Full diff content */
  rawDiff: string;
  /** Analyzed files */
  files: string[];
  /** Total lines affected */
  totalLines: number;
}

/**
 * Parameters for the review_code MCP tool.
 */
export interface ReviewCodeParams {
  /** Path to the file or directory to review */
  targetPath: string;
  /** Custom instructions for the review */
  instructions?: string;
  /** Output format for the report */
  format?: ReportFormat;
}

/**
 * Parameters for the review_git_diff MCP tool.
 */
export interface ReviewGitDiffParams {
  /** Git reference (commit, branch, or "HEAD") to diff against */
  target?: string;
  /** Base git reference (defaults to "HEAD") */
  base?: string;
  /** Custom instructions for the review */
  instructions?: string;
  /** Output format for the report */
  format?: ReportFormat;
}

/**
 * Parameters for the get_fix MCP tool.
 */
export interface GetFixParams {
  /** Review ID to get fixes for */
  reviewId: string;
  /** Optional issue index to get fix for a specific issue */
  issueIndex?: number;
  /** File path to scope the fix to */
  filePath?: string;
}

/**
 * Error response structure for the tool.
 */
export interface ToolError {
  /** Error code */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Optional details for debugging */
  details?: string;
}
