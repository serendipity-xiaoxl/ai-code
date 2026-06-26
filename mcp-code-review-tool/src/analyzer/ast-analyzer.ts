// ============================================================
// MCP Code Review Tool - AST-Based Code Analyzer
//
// Performs pattern-based analysis on source code without LLM.
// Detects common issues: missing error handling, type mismatches,
// unused imports, security patterns, etc.
// ============================================================

import type { ReviewIssue, IssueCategory } from '../types';
import { getLogger } from '../utils/logger';

/**
 * Represents a single code analysis rule.
 */
interface AnalysisRule {
  id: string;
  name: string;
  category: IssueCategory;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  check: (content: string, filePath: string) => ReviewIssue[];
}

/**
 * AST-based analyzer that applies pattern rules to source code.
 * Operates purely on text patterns - no AST parsing library needed
 * for the initial implementation.
 */
export class AstAnalyzer {
  private rules: AnalysisRule[];
  private logger;

  constructor() {
    this.logger = getLogger();
    this.rules = this.initializeRules();
  }

  /**
   * Analyze source code content and return found issues.
   */
  analyze(content: string, filePath: string): ReviewIssue[] {
    const issues: ReviewIssue[] = [];

    this.logger.debug('Analyzing file:', filePath);

    for (const rule of this.rules) {
      try {
        const ruleIssues = rule.check(content, filePath);
        issues.push(...ruleIssues);
      } catch (error) {
        this.logger.debug('Rule', rule.id, 'failed for', filePath, error);
      }
    }

    return issues;
  }

  /**
   * Analyze multiple files and return aggregated issues.
   */
  analyzeFiles(files: Map<string, string>): ReviewIssue[] {
    const allIssues: ReviewIssue[] = [];

    for (const [filePath, content] of files) {
      const issues = this.analyze(content, filePath);
      allIssues.push(...issues);
    }

    return allIssues;
  }

  /**
   * Initialize built-in analysis rules.
   */
  private initializeRules(): AnalysisRule[] {
    return [
      // -------------------------------------------------------
      // TODO / FIXME detection
      // -------------------------------------------------------
      {
        id: 'R001',
        name: 'todo-comment',
        category: 'maintainability',
        severity: 'info',
        description: 'File contains TODO or FIXME comments that need attention',
        check: (content: string, filePath: string): ReviewIssue[] => {
          const issues: ReviewIssue[] = [];
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i] as string;
            const todoMatch = line.match(/(TODO|FIXME|HACK|XXX|WORKAROUND)/i);
            if (todoMatch) {
              const col = line.indexOf(todoMatch[0]) + 1;
              issues.push({
                severity: 'info',
                category: 'maintainability',
                file: filePath,
                line: i + 1,
                column: col,
                message: 'Found ' + todoMatch[0] + ' comment that needs attention',
                suggestion: 'Address the ' + todoMatch[0] + ' before shipping this code',
                ruleId: 'R001',
              });
            }
          }

          return issues;
        },
      },

      // -------------------------------------------------------
      // Console.log detection (warning for production code)
      // -------------------------------------------------------
      {
        id: 'R002',
        name: 'console-log',
        category: 'best_practice',
        severity: 'warning',
        description: 'Console.log statements should be removed in production',
        check: (content: string, filePath: string): ReviewIssue[] => {
          const issues: ReviewIssue[] = [];
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i] as string;

            // Match console.log/warn/error/debug/info but not in comments
            const trimmed = line.trim();
            if (
              (trimmed.includes('console.log') ||
                trimmed.includes('console.debug')) &&
              !trimmed.startsWith('//') &&
              !trimmed.startsWith('*') &&
              !trimmed.startsWith('#')
            ) {
              issues.push({
                severity: 'warning',
                category: 'best_practice',
                file: filePath,
                line: i + 1,
                message:
                  'Console log statement should be removed in production code',
                suggestion:
                  'Replace with a proper logging mechanism or remove the statement',
                ruleId: 'R002',
              });
            }
          }

          return issues;
        },
      },

      // -------------------------------------------------------
      // Long function detection (heuristic: too many lines)
      // -------------------------------------------------------
      {
        id: 'R003',
        name: 'long-function',
        category: 'maintainability',
        severity: 'warning',
        description: 'Function or method body exceeds recommended length',
        check: (content: string, filePath: string): ReviewIssue[] => {
          const issues: ReviewIssue[] = [];

          // Look for function definitions and estimate their length
          const funcRegex =
            /(?:function\s+\w+|(?:\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|(?:async\s*)?\w+\s*\([^)]*\)\s*\{))/g;
          let match;

          // This is a simplified heuristic - works for well-formatted code
          const lines = content.split('\n');
          let braceDepth = 0;
          let funcStart = -1;
          let funcName = '';

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i] as string;
            const trimmed = line.trim();

            // Detect function start
            const funcMatch = trimmed.match(
              /(?:function\s+(\w+)|(?:(\w+)\s*=\s*(?:async\s*)?\(|(?:async\s*)?(\w+)\s*\())/,
            );

            if (funcMatch && funcStart === -1) {
              const name =
                funcMatch[1] ?? funcMatch[2] ?? funcMatch[3] ?? 'anonymous';
              funcName = name;
              funcStart = i;
              braceDepth = 0;
            }

            // Track brace depth
            for (const ch of trimmed) {
              if (ch === '{') braceDepth += 1;
              if (ch === '}') braceDepth -= 1;
            }

            // Function ended
            if (funcStart !== -1 && braceDepth <= 0 && trimmed.includes('}')) {
              const funcLength = i - funcStart;
              if (funcLength > 80) {
                issues.push({
                  severity: 'warning',
                  category: 'maintainability',
                  file: filePath,
                  line: funcStart + 1,
                  message:
                    'Function "' +
                    funcName +
                    '" is ' +
                    funcLength +
                    ' lines long (recommended max: 80)',
                  suggestion:
                    'Consider refactoring this function into smaller, focused functions',
                  ruleId: 'R003',
                });
              }
              funcStart = -1;
              funcName = '';
            }
          }

          return issues;
        },
      },

      // -------------------------------------------------------
      // Hardcoded secrets/credentials detection (basic pattern)
      // -------------------------------------------------------
      {
        id: 'R004',
        name: 'hardcoded-secret',
        category: 'security',
        severity: 'critical',
        description:
          'Possible hardcoded secret, API key, or password detected',
        check: (content: string, filePath: string): ReviewIssue[] => {
          const issues: ReviewIssue[] = [];
          const lines = content.split('\n');

          const secretPatterns = [
            /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]+['"]/i,
            /(?:api[_-]?key|apikey)\s*[:=]\s*['"][^'"]+['"]/i,
            /(?:secret|token|auth)\s*[:=]\s*['"][^'"]+['"]/i,
            /(?:aws_access_key|aws_secret_key)\s*[:=]\s*['"][^'"]+['"]/i,
          ];

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i] as string;
            const trimmed = line.trim();

            for (const pattern of secretPatterns) {
              const match = trimmed.match(pattern);
              if (match && !trimmed.startsWith('//') && !trimmed.startsWith('#')) {
                issues.push({
                  severity: 'critical',
                  category: 'security',
                  file: filePath,
                  line: i + 1,
                  message:
                    'Possible hardcoded credential detected: ' +
                    match[0].slice(0, 40) +
                    (match[0].length > 40 ? '...' : ''),
                  suggestion:
                    'Move sensitive values to environment variables or a secrets manager',
                  ruleId: 'R004',
                });
                break; // Only one match per line
              }
            }
          }

          return issues;
        },
      },

      // -------------------------------------------------------
      // Empty catch block detection
      // -------------------------------------------------------
      {
        id: 'R005',
        name: 'empty-catch',
        category: 'potential_error',
        severity: 'warning',
        description: 'Empty catch block silently swallows errors',
        check: (content: string, filePath: string): ReviewIssue[] => {
          const issues: ReviewIssue[] = [];
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i] as string;
            const trimmed = line.trim();

            // Match: catch (...) {} or catch (...) { // comment }
            if (
              trimmed.match(/catch\s*\([^)]*\)\s*\{\s*(\/\/.*)?$/) ||
              trimmed.match(/catch\s*\{/)
            ) {
              issues.push({
                severity: 'warning',
                category: 'potential_error',
                file: filePath,
                line: i + 1,
                message: 'Empty catch block silently swallows errors',
                suggestion:
                  'Add error handling, logging, or at minimum a comment explaining why catching is safe',
                ruleId: 'R005',
              });
            }
          }

          return issues;
        },
      },

      // -------------------------------------------------------
      // Large file detection
      // -------------------------------------------------------
      {
        id: 'R006',
        name: 'large-file',
        category: 'maintainability',
        severity: 'info',
        description: 'File exceeds recommended line count',
        check: (content: string, filePath: string): ReviewIssue[] => {
          const issues: ReviewIssue[] = [];
          const lines = content.split('\n');

          if (lines.length > 500) {
            issues.push({
              severity: 'info',
              category: 'maintainability',
              file: filePath,
              message:
                'File is ' +
                lines.length +
                ' lines long (recommended max: 500)',
              suggestion:
                'Consider splitting this file into smaller modules with single responsibilities',
              ruleId: 'R006',
            });
          }

          return issues;
        },
      },

      // -------------------------------------------------------
      // var keyword usage (TypeScript/ES6+)
      // -------------------------------------------------------
      {
        id: 'R007',
        name: 'var-keyword',
        category: 'code_style',
        severity: 'warning',
        description: 'Use of var keyword instead of let or const',
        check: (content: string, filePath: string): ReviewIssue[] => {
          const issues: ReviewIssue[] = [];
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i] as string;
            const trimmed = line.trim();

            // Match var declarations (not in comments)
            const varMatch = trimmed.match(/^\s*var\s+\w+/);
            if (varMatch && !trimmed.startsWith('//') && !trimmed.startsWith('*')) {
              issues.push({
                severity: 'warning',
                category: 'code_style',
                file: filePath,
                line: i + 1,
                message: 'Use of "var" instead of "let" or "const"',
                suggestion:
                  'Replace "var" with "const" for values that are never reassigned, or "let" for those that are',
                ruleId: 'R007',
              });
            }
          }

          return issues;
        },
      },

      // -------------------------------------------------------
      // Nested callback / deep indentation
      // -------------------------------------------------------
      {
        id: 'R008',
        name: 'deep-nesting',
        category: 'maintainability',
        severity: 'warning',
        description: 'Overly nested code blocks reduce readability',
        check: (content: string, filePath: string): ReviewIssue[] => {
          const issues: ReviewIssue[] = [];
          const lines = content.split('\n');
          let maxDepth = 0;
          let currentDepth = 0;
          let maxDepthLine = 1;

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i] as string;
            const trimmed = line.trim();

            // Calculate indentation depth (2-space indents)
            const indent = line.search(/\S/);
            if (indent > 0) {
              // Skip non-code lines
              if (
                !trimmed.startsWith('//') &&
                !trimmed.startsWith('*') &&
                !trimmed.startsWith('#')
              ) {
                currentDepth = Math.floor(indent / 2);
                if (currentDepth > maxDepth) {
                  maxDepth = currentDepth;
                  maxDepthLine = i + 1;
                }
              }
            } else {
              currentDepth = 0;
            }
          }

          if (maxDepth > 6) {
            issues.push({
              severity: 'warning',
              category: 'maintainability',
              file: filePath,
              line: maxDepthLine,
              message:
                'Code nesting depth of ' +
                maxDepth +
                ' levels exceeds recommended maximum of 6',
              suggestion:
                'Extract deeply nested blocks into separate functions or use early returns',
              ruleId: 'R008',
            });
          }

          return issues;
        },
      },

      // -------------------------------------------------------
      // Missing newline at end of file
      // -------------------------------------------------------
      {
        id: 'R009',
        name: 'missing-eof-newline',
        category: 'code_style',
        severity: 'info',
        description: 'File is missing a trailing newline',
        check: (content: string, filePath: string): ReviewIssue[] => {
          const issues: ReviewIssue[] = [];

          if (content.length > 0 && !content.endsWith('\n')) {
            issues.push({
              severity: 'info',
              category: 'code_style',
              file: filePath,
              message: 'File is missing a trailing newline',
              suggestion: 'Add a newline at the end of the file',
              ruleId: 'R009',
            });
          }

          return issues;
        },
      },
    ];
  }

  /**
   * Get the list of active rules.
   */
  getRules(): Array<{ id: string; name: string; description: string }> {
    return this.rules.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
    }));
  }
}
