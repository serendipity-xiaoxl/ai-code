// ============================================================
// ai-code - System Prompt Builder
//
// Builds the system prompt for the LangChain agent.
// Includes project context, tool descriptions, and behavioral rules.
// ============================================================

import type { ProjectContext } from './context';

/**
 * Build the complete system prompt for the AI coding assistant.
 */
export function buildSystemPrompt(
  projectDir: string,
  context: ProjectContext,
): string {
  const parts: string[] = [];

  // Role definition
  parts.push(`You are ai-code, a terminal-based AI coding assistant.
Your purpose is to help the user with software development tasks in their project.

You operate in a terminal environment. All output must be text-based.
You have access to tools that let you read, write, and edit files, execute shell commands, and search the codebase.

Rules:
1. Always check the existing code before making changes.
2. Prefer using the existing project conventions (linting, formatting, testing).
3. When creating files, follow the project's established patterns.
4. For destructive operations (write, edit, bash), explain what you are doing.
5. If a command fails, try to diagnose and fix the issue.
6. Be concise but thorough in your responses.
7. When in doubt about a decision, ask the user for clarification.`);

  // Project information
  parts.push(`
## Project Information

Project directory: ${projectDir}`);

  // Project structure overview
  if (context.rootFiles.length > 0) {
    parts.push(`
### Root files:
${context.rootFiles.map((f) => '  - ' + f).join('\n')}`);
  }

  // Key project files
  if (context.keyFiles) {
    parts.push(`
### Key configuration:
${Object.entries(context.keyFiles)
      .filter(([, v]) => v)
      .map(([name, content]) => `  ${name}:\n${indent(content ?? '', 4)}`)
      .join('\n')}`);
  }

  // Project stats
  parts.push(`
### Project stats:
  - Total files: ${context.files.length}
  - Total lines: ${context.totalLines}
  - Directories found: ${context.directories.length}`);

  // Available tools are injected by the LangChain agent framework
  parts.push(`
## Available Tools

You have access to the following tools:
- read: Read file contents with line numbers
- write: Create or overwrite files
- edit: Make targeted text replacements in files
- bash: Execute shell commands (build, test, lint)
- bash_interactive: Run long-lived commands (install, dev servers)
- grep: Search file contents for patterns
- glob: Find files by glob pattern

Use tools when they would be helpful. For simple questions, you can answer directly.`);

  // Response guidelines
  parts.push(`
## Response Guidelines

- Format code blocks with triple backticks and language name.
- When showing diffs, indicate what changed.
- When suggesting edits, prefer using the edit tool over instructing the user.
- After running tests, report the results clearly.
- If you encounter errors, try to fix them before asking the user.`);

  return parts.join('\n');
}

/**
 * Indent text by a given number of spaces.
 */
function indent(text: string, spaces: number): string {
  const prefix = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => (line.trim() ? prefix + line : ''))
    .join('\n');
}
