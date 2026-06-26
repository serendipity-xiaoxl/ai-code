// ============================================================
// MCP Code Review Tool - Basic Usage Example
//
// Shows how to use the code review tool programmatically.
//
// Run: bun run examples/basic-usage.ts
// ============================================================

import { ReviewChain } from '../src/agent/review-chain';
import { TerminalReporter } from '../src/reporter/terminal-reporter';
import { MarkdownReporter } from '../src/reporter/markdown-reporter';
import { JsonReporter } from '../src/reporter/json-reporter';
import { AstAnalyzer } from '../src/analyzer/ast-analyzer';
import { setLogger, Logger } from '../src/utils/logger';

// Set log level to debug
setLogger(new Logger('debug', 'Example'));

/**
 * Example 1: Basic static analysis of some code.
 */
async function exampleStaticAnalysis(): Promise<void> {
  console.log('\n========================================');
  console.log('EXAMPLE 1: Static Analysis');
  console.log('========================================\n');

  const code = `
function processUserData(input: string) {
  // TODO: add input validation
  var data = JSON.parse(input);
  console.log("Processing:", data);

  if (data.password === "admin123") {
    // FIXME: hardcoded credentials
    return authenticate("admin", "admin123");
  }

  try {
    return transformData(data);
  } catch (e) {
    // empty catch
  }
}
`.trim();

  const analyzer = new AstAnalyzer();
  const issues = analyzer.analyze(code, 'example.ts');

  console.log('Found', issues.length, 'issues:');
  for (const issue of issues) {
    console.log('  [' + issue.severity + '] ' + issue.message);
    console.log('    ->', issue.suggestion);
  }
}

/**
 * Example 2: Using the review chain with AI (requires API key).
 */
async function exampleAiReview(): Promise<void> {
  console.log('\n========================================');
  console.log('EXAMPLE 2: AI-Powered Review');
  console.log('========================================\n');

  const apiKey = process.env['OPENAI_API_KEY'] || process.env['ANTHROPIC_API_KEY'];

  if (!apiKey) {
    console.log('  SKIPPED: No API key set.');
    console.log('  Set OPENAI_API_KEY or ANTHROPIC_API_KEY env var and try again.\n');
    return;
  }

  const provider = process.env['MCP_REVIEW_PROVIDER'] || 'openai';

  const files = new Map<string, string>([
    [
      'src/helper.ts',
      `
export function calculateTotal(items: number[]): number {
  var sum = 0;
  for (var i = 0; i < items.length; i++) {
    sum += items[i];
  }
  // TODO: add logging
  return sum;
}

function authenticate(token: string): boolean {
  if (token === "super-secret-token") {
    return true;
  }
  console.log("Auth failed");
  return false;
}
`.trim(),
    ],
  ]);

  const chain = new ReviewChain({
    modelProvider: provider as 'openai' | 'anthropic',
    modelName: provider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-4o',
    apiKey,
    temperature: 0.1,
  });

  const review = await chain.reviewFiles(files, 'Focus on security and best practices');

  // Output in all formats
  console.log('Terminal Output:\n');
  const terminalReporter = new TerminalReporter();
  console.log(terminalReporter.generate(review));

  console.log('\nCompact Status:', terminalReporter.generateCompact(review));
}

/**
 * Example 3: Generate all report formats.
 */
async function exampleAllFormats(): Promise<void> {
  console.log('\n========================================');
  console.log('EXAMPLE 3: All Report Formats');
  console.log('========================================\n');

  // Reuse static analysis from example 1
  const code = 'var x = "password: secret"; // TODO: fix this';
  const analyzer = new AstAnalyzer();
  const issues = analyzer.analyze(code, 'test.ts');

  const mockReview = {
    id: 'demo-review',
    timestamp: new Date().toISOString(),
    config: { modelProvider: 'openai' as const, modelName: 'gpt-4o', apiKey: 'sk-...' },
    files: ['test.ts'],
    diff: [],
    issues,
    summary: {
      totalIssues: issues.length,
      criticalCount: issues.filter((i) => i.severity === 'critical').length,
      warningCount: issues.filter((i) => i.severity === 'warning').length,
      infoCount: issues.filter((i) => i.severity === 'info').length,
      categories: {} as Record<string, number>,
      filesReviewed: 1,
      totalLines: 1,
      overallScore: Math.max(0, 100 - issues.length * 5),
      durationMs: 100,
    },
    explanation: 'Sample review for demonstration.',
  };

  // Populate categories
  for (const issue of issues) {
    mockReview.summary.categories[issue.category] =
      (mockReview.summary.categories[issue.category] ?? 0) + 1;
  }

  console.log('-- Terminal format --');
  const termReporter = new TerminalReporter({ color: false });
  console.log(termReporter.generate(mockReview));

  console.log('\n-- Markdown format --');
  const mdReporter = new MarkdownReporter();
  console.log(mdReporter.generate(mockReview));

  console.log('\n-- JSON format --');
  const jsonReporter = new JsonReporter();
  console.log(jsonReporter.generate(mockReview));
}

/**
 * Run all examples.
 */
async function main(): Promise<void> {
  await exampleStaticAnalysis();
  await exampleAllFormats();
  await exampleAiReview();
}

main().catch(console.error);
