# Phase 2 Remaining Features: Product Specifications

> **Status:** Draft v1
> **Date:** 2026-06-26
> **Author:** Product Manager
> **Context:** Phase 1 MVP is complete. Phase 2 partially done (Config, permission guard, context compaction, input UI, file references, Node.js compatibility, binary packaging). This document covers the 3 remaining Phase 2 features.

---

## Table of Contents

1. [Priority Summary](#1-priority-summary)
2. [Feature A: File Diff (P0)](#2-feature-a-file-diff-p0)
3. [Feature B: Batch File Editing (P1)](#3-feature-b-batch-file-editing-p1)
4. [Feature C: Git Integration (P1)](#4-feature-c-git-integration-p1)
5. [Implementation Notes](#5-implementation-notes)

---

## 1. Priority Summary

| Rank | Feature | Priority | Effort | Value | Dependencies |
|------|---------|----------|--------|-------|-------------|
| 1 | File Diff | **P0** | Small (2-3 days) | High | None |
| 2 | Batch File Editing | **P1** | Medium (4-5 days) | High | File Diff (for preview) |
| 3 | Git Integration | **P1** | Large (5-7 days) | High | None |

### Rationale

**File Diff (P0)** is ranked highest because:

1. It is a **prerequisite for trustworthy editing** -- users need to see what changed before and after an edit operation. Without diff, every tool-driven change is opaque.
2. **Minimal implementation risk** -- the renderer already has a `diffLine()` function and the project has existing test patterns for file tools. The core logic (comparing two strings to produce unified-diff output) is well-understood.
3. **Unlocks Batch Editing** -- batch editing without diff preview is high-risk. File Diff provides the safety net.
4. **Quickest time-to-value** -- estimated 2-3 days for a fully tested implementation.

**Batch File Editing (P1)** is ranked second because:

1. It **directly addresses a core user pain point** -- editing multiple files (e.g., renaming a symbol across a project, adding imports to N files) currently requires N separate edit tool calls, each going through the LLM tool-calling loop. Batch editing collapses this into one operation.
2. It **requires the diff tool** for preview mode -- users should always see a diff before applying batch changes.
3. Medium complexity -- requires careful Zod schema design and permission guard integration.

**Git Integration (P1)** is ranked third because:

1. It is the **most valuable standalone feature** for developer workflow but also the largest in scope.
2. It **can be developed independently** from the other two features, so it can be worked on in parallel.
3. Git integration opens the door to higher-level operations (auto-commit, PR creation) in future phases.

---

## 2. Feature A: File Diff (P0)

### 2.1 User Story

**As a** developer using ai-code,
**I want** to see a clear, colorized diff of changes before and after file edits,
**so that** I can verify the AI's changes are correct before accepting them.

### 2.2 User Scenarios

#### Scenario 1: Diff two files

```
User: "Show me the diff between src/old.ts and src/new.ts"

AI invokes: diff(fileA="src/old.ts", fileB="src/new.ts")

Terminal output:

  [DIFF] src/old.ts -> src/new.ts
  --- a/src/old.ts
  +++ b/src/new.ts
  @@ -10,6 +10,7 @@
   function hello() {
     console.log("hello");
  +  console.log("world");
     return 42;
   }
```

#### Scenario 2: Diff a file against its working-tree state

```
User: "What changes did you just make to src/index.ts?"

AI invokes: diff(filePath="src/index.ts", workingTree=true)

Terminal output:

  [DIFF] src/index.ts (working tree changes)
  --- a/src/index.ts
  +++ b/src/index.ts (current)
  @@ -15,7 +15,7 @@
   const PORT = 3000;
  -const HOST = "localhost";
  +const HOST = "0.0.0.0";
   const start = () => { ... };
```

#### Scenario 3: Diff with staged changes (Git-aware)

```
User: "Show me the diff of staged changes"

AI invokes: diff(gitStaged=true)

Terminal output:

  [DIFF] Staged changes
  --- a/src/config.ts
  +++ b/src/config.ts
  @@ -1,5 +1,6 @@
   export const config = {
     port: 3000,
  +  host: "0.0.0.0",
     debug: false,
   };
```

### 2.3 Interaction Design

#### Tool Interface

```typescript
// Tool name: "diff"
// Description: "Show differences between files, or between a file and its
//               working-tree/git-staged version. Uses unified diff format."

const DiffSchema = z.object({
  filePath: z.string()
    .optional()
    .describe('Path to a file to diff. Use with fileB or workingTree/gitStaged flags.'),
  fileB: z.string()
    .optional()
    .describe('Second file path to compare against filePath.'),
  workingTree: z.boolean()
    .optional()
    .default(false)
    .describe('Compare filePath against its last-saved version on disk.'),
  gitStaged: z.boolean()
    .optional()
    .default(false)
    .describe('Show git staged changes. Ignores filePath/fileB when true.'),
  contextLines: z.number()
    .int()
    .min(0)
    .max(20)
    .optional()
    .default(3)
    .describe('Number of context lines around each change.'),
});
```

**Validation Rules:**
- Exactly one mode must be specified: (1) filePath + fileB, (2) filePath + workingTree, (3) gitStaged alone
- If `workingTree` is true, `fileB` must not be set
- If `gitStaged` is true, both `filePath` and `fileB` are ignored
- If nothing is set, return an error: "Specify files to diff (diff fileA=a fileB=b)"

#### Terminal UI

The existing `renderer.diffLine()` function (in `markdown.ts`) already supports the visual format:

```typescript
// Existing signature:
diffLine(type: 'add' | 'del' | 'context', content: string): string
```

**Full diff display format:**

```
  [DIFF] <title>
  --- <a-label>
  +++ <b-label>
  @@ -<aStart>,<aCount> +<bStart>,<bCount> @@
   <context-line>
  -<removed-line>
  +<added-line>
   <context-line>
```

**Color scheme** (uses existing ANSI constants from markdown.ts):

| Element | Color | ANSI Code |
|---------|-------|-----------|
| `[DIFF]` header | Bold + Magenta | `\x1b[1m\x1b[35m` |
| Chunk header `@@ ... @@` | Cyan | `\x1b[36m` |
| `+` added line | Green | `\x1b[32m` |
| `-` removed line | Red | `\x1b[31m` |
| Context line | Default | (none) |
| `---` / `+++` paths | Dim | `\x1b[2m` |

**For empty result:**
```
  [DIFF] src/index.ts
  No differences found.
```

**For file-not-found:**
```
  [ERROR] File not found: src/nonexistent.ts
```

### 2.4 Success Criteria

1. [ ] Tool produces valid unified-diff output for any two text files
2. [ ] Tool correctly computes working-tree changes (reads current file, diffs against itself... or more practically: the file on disk vs what the agent tracks)
3. [ ] Git staged diff works (shells out to `git diff --cached`)
4. [ ] Context line count is respected (0 = no context, 3 = default, max 20)
5. [ ] Colorized terminal output matches existing project patterns
6. [ ] Error handling for: nonexistent files, binary files, permission denied, outside git repo
7. [ ] All modes have at least one test case
8. [ ] Performance: diff of a 10,000-line file completes in under 500ms
9. [ ] ASCII-only output guaranteed

### 2.5 Edge Cases

- **Binary files:** Detect and return error: "Cannot diff binary file: <path>"
- **Identical files:** Return "No differences found."
- **Very large diffs:** Truncate at 2000 lines with message "[... truncated at 2000 lines ...]"
- **Empty files:** Handle gracefully (empty string)
- **Non-existent intermediate path with workingTree=true:** Return the file content as all additions
- **Not a git repository with gitStaged=true:** Return error "Not a git repository"
- **File changed between read and diff:** Always diff against the on-disk version at call time

### 2.6 Files to Create/Modify

- **NEW:** `src/tools/diff/tools.ts` -- Tool factory `createDiffTool()`
- **NEW:** `test/tools/diff-tools.test.ts` -- Tests
- **MODIFY:** `src/tools/file/tools.ts` or `src/agent/index.ts` -- Register the tool

---

## 3. Feature B: Batch File Editing (P1)

### 3.1 User Story

**As a** developer using ai-code,
**I want** to apply a single change (find-and-replace) across multiple files,
**so that** I can make project-wide refactors efficiently.

### 3.2 User Scenarios

#### Scenario 1: Rename a symbol across the project

```
User: "Rename the function 'calculate' to 'compute' across all TypeScript files"

AI invokes: batchEdit(
  pattern="calculate",
  replacement="compute",
  glob="src/**/*.ts",
  preview=true
)

Terminal output:

  [BATCH EDIT] Preview: 'calculate' -> 'compute' in src/**/*.ts
  +----------+--------+----------+
  | File     | Occurrences | Status |
  +----------+--------+----------+
  | src/a.ts | 3      | changed |
  | src/b.ts | 1      | changed |
  | src/c.ts | 0      | skipped |
  +----------+--------+----------+
  2 files will be changed, 1 skipped.

User: "Apply it"

AI invokes: batchEdit(
  pattern="calculate",
  replacement="compute",
  glob="src/**/*.ts",
  preview=false
)
```

#### Scenario 2: Multi-pattern batch edit

```
User: "Update all imports from 'old-lib' to 'new-lib'"

AI invokes: batchEdit(
  edits=[
    { pattern: "from 'old-lib'", replacement: "from 'new-lib'" },
    { pattern: "require('old-lib')", replacement: "require('new-lib')" },
  ],
  glob="src/**/*.ts",
  preview=true
)
```

#### Scenario 3: Batch edit with confirmed application

```
User: "Add 'use strict' to all JS files that don't have it"

AI invokes: batchEdit(
  pattern="^",
  replacement="'use strict';\n",
  glob="src/**/*.js",
  multiline=true,
  preview=true
)

Terminal output:

  [BATCH EDIT] Preview: Add 'use strict' to src/**/*.js
  +----------+---------+---------+
  | File     | Changes | Status  |
  +----------+---------+---------+
  | src/a.js | 1       | changed |
  | src/b.js | 1       | changed |
  | src/c.js | 0       | skipped (already has 'use strict') |
  +----------+---------+---------+

  [INFO] Use bash_interactive to confirm by reviewing diffs,
         then call batchEdit with preview=false to apply.
```

### 3.3 Interaction Design

#### Tool Interface

```typescript
// Tool name: "batch_edit"
// Description: "Apply find-and-replace across multiple files matching a glob.
//               Supports multi-pattern edits and preview mode."

const BatchEditSchema = z.object({
  edits: z.array(z.object({
    pattern: z.string().describe('The text to find (exact match by default)'),
    replacement: z.string().describe('The replacement text'),
  })).min(1).max(10)
    .describe('One or more find-replace pairs to apply.'),
  glob: z.string()
    .describe('Glob pattern to match files to edit (e.g., "src/**/*.ts")'),
  preview: z.boolean()
    .optional()
    .default(true)
    .describe('If true, only show what would be changed without applying.'),
  regex: z.boolean()
    .optional()
    .default(false)
    .describe('If true, treat pattern as a regex (uses new RegExp).'),
  multiline: z.boolean()
    .optional()
    .default(false)
    .describe('If true, ^ and $ match line boundaries. Only meaningful with regex=true.'),
  caseSensitive: z.boolean()
    .optional()
    .default(true)
    .describe('If false, case-insensitive matching.'),
});
```

**Permission Guard:** This tool MUST be guarded. When preview=false, the user should see:

```
  [CONFIRM] batch_edit will modify 3 files:
    src/a.ts (2 changes)
    src/b.ts (1 change)
    src/c.ts (3 changes)
  Apply these changes? (y/N)
```

#### Terminal UI

**Preview mode output:**

```
  [BATCH EDIT] Preview: <summary> in <glob>

  <renderer.table>
  | File       | Changes | Status  |
  |------------+---------+---------|
  | src/a.ts   | 2       | changed |
  | src/b.ts   | 1       | changed |
  | src/c.ts   | 0       | skipped |

  Summary: 2 files changed, 1 file skipped, 3 total changes.
  Use batchEdit with preview=false to apply these changes.
```

**Apply mode output (success):**

```
  [BATCH EDIT] Applied <n> changes across <m> files.
  +----------+---------+--------+
  | File     | Changes | Status |
  +----------+---------+--------+
  | src/a.ts | 2       | OK     |
  | src/b.ts | 1       | OK     |
  +----------+---------+--------+
```

**Apply mode output (partial failure):**

```
  [BATCH EDIT] Applied 3 changes across 4 files.
  +----------+---------+-----------+
  | File     | Changes | Status    |
  +----------+---------+-----------+
  | src/a.ts | 2       | OK        |
  | src/b.ts | 1       | OK        |
  | src/c.ts | 0       | read-only |
  +----------+---------+-----------+
  [WARN] 1 file could not be edited.
```

### 3.4 Success Criteria

1. [ ] Single-pattern batch edit works across multiple files
2. [ ] Multi-pattern (up to 10 pairs) batch edit works
3. [ ] Preview mode shows accurate change counts without modifying files
4. [ ] Apply mode with preview=false actually modifies files and shows summary
5. [ ] Permission guard prompts before applying changes
6. [ ] Glob pattern correctly filters files
7. [ ] Regex mode works correctly (basic JavaScript RegExp)
8. [ ] Case-insensitive mode works
9. [ ] Error handling for: empty glob results, read-only files, binary files, invalid regex
10. [ ] Rolling back on partial failure is documented in the tool's behavior (the tool either reports which files failed, or rolls back all changes -- prefer "report failures" over rollback to avoid unintended consequences)
11. [ ] Test coverage: preview, apply, multi-pattern, regex, error cases
12. [ ] No file is edited more than once (dedup by resolved absolute path)

### 3.5 Edge Cases

- **Glob matches 0 files:** Return "No files match glob pattern <pattern>"
- **Pattern not found in a file:** Skip that file (count = 0, status = "skipped")
- **File is read-only:** Skip with status "read-only"
- **Very large number of matched files (>50):** Warn "Batch edit matched N files. Limit to 50."
  - The tool should cap at 50 files to prevent excessive token usage
- **Binary files in glob results:** Auto-skip with status "binary"
- **Interrupted apply (partial):** Report which files succeeded and which failed. Do NOT auto-rollback.
- **Edit would produce identical file:** Skip (status = "unchanged")
- **Maximum total changes:** Cap at 500 total changes across all files to prevent runaway operations

### 3.6 Files to Create/Modify

- **NEW:** `src/tools/batch/tools.ts` -- Tool factory `createBatchEditTool()`
- **NEW:** `test/tools/batch-tools.test.ts` -- Tests
- **MODIFY:** `src/tools/guard.ts` or the permission check flow -- Register batch_edit as a sensitive tool
- **MODIFY:** `src/agent/index.ts` -- Register the tool

---

## 4. Feature C: Git Integration (P1)

### 4.1 User Story

**As a** developer using ai-code,
**I want** to view git status, diff, log, and stage/commit changes through natural language,
**so that** I can stay in the AI coding flow without switching to a terminal for git operations.

### 4.2 User Scenarios

#### Scenario 1: Check git status

```
User: "What's the current git status?"

AI invokes: gitStatus()

Terminal output:

  [GIT] Status (branch: feature/new-api)
  +----------+---------+
  | Status   | File    |
  +----------+---------+
  | M        | src/a.ts |
  | M        | src/b.ts |
  | ??       | src/new.ts |
  +----------+---------+
  2 modified, 1 untracked
```

#### Scenario 2: View staged diff

```
User: "Show me what's staged"

AI invokes: gitDiff(staged=true)

Terminal output (uses the diff renderer from Feature A):
  [GIT] Staged changes
  ...
```

#### Scenario 3: Commit staged changes

```
User: "Stage all changes and commit with message 'fix: resolve login bug'"

AI invokes: gitAdd(pathspec=".")
AI invokes: gitCommit(message="fix: resolve login bug")

Terminal output:

  [GIT] Staged all changes
  [GIT] Committed:
    commit a1b2c3d4e5f6...
    Author: user
    Date:   2026-06-26 12:34
    fix: resolve login bug
```

#### Scenario 4: View recent log

```
User: "Show the last 5 commits"

AI invokes: gitLog(maxCount=5)

Terminal output:

  [GIT] Recent commits (branch: main)
  +----------+--------+---------------------+
  | Hash     | Author | Message             |
  +----------+--------+---------------------+
  | a1b2c3d  | user   | fix: resolve bug    |
  | e5f6a7b  | user   | feat: add feature   |
  | c8d9e0f  | user   | Initial commit      |
  +----------+--------+---------------------+
```

#### Scenario 5: Create a branch

```
User: "Create and switch to a branch called feature/new-api"

AI invokes: gitBranch(name="feature/new-api", checkout=true)

Terminal output:

  [GIT] Created and switched to branch: feature/new-api
```

### 4.3 Interaction Design

#### Tool Interface

Four separate tools, each focused on a single git operation:

```typescript
// --- TOOL: git_status ---
const GitStatusSchema = z.object({
  pathspec: z.string()
    .optional()
    .describe('Optional pathspec to filter status (e.g., "src/")'),
  short: z.boolean()
    .optional()
    .default(true)
    .describe('Use short format (default: true)'),
});

// --- TOOL: git_diff ---
const GitDiffSchema = z.object({
  staged: z.boolean()
    .optional()
    .default(false)
    .describe('If true, diff staged changes (git diff --cached)'),
  filePath: z.string()
    .optional()
    .describe('Optional file path to filter diff'),
  contextLines: z.number()
    .int()
    .min(0)
    .max(20)
    .optional()
    .default(3),
});

// --- TOOL: git_commit ---
const GitCommitSchema = z.object({
  message: z.string()
    .min(1)
    .max(200)
    .describe('Commit message'),
  all: z.boolean()
    .optional()
    .default(false)
    .describe('If true, automatically stage all modified/deleted files (git commit -a)'),
  allowEmpty: z.boolean()
    .optional()
    .default(false)
    .describe('Allow empty commit (no changes)'),
});

// --- TOOL: git_log ---
const GitLogSchema = z.object({
  maxCount: z.number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(10)
    .describe('Maximum number of commits to show'),
  filePath: z.string()
    .optional()
    .describe('Optional file path to filter history for a specific file'),
  format: z.enum(['oneline', 'short', 'full'])
    .optional()
    .default('oneline')
    .describe('Log output format'),
});

// --- TOOL: git_branch ---
const GitBranchSchema = z.object({
  name: z.string()
    .min(1)
    .describe('Branch name to create'),
  checkout: z.boolean()
    .optional()
    .default(false)
    .describe('If true, switch to the new branch after creation'),
});

// --- TOOL: git_add ---
const GitAddSchema = z.object({
  pathspec: z.string()
    .optional()
    .default('.')
    .describe('Files to stage (default: "." for all)'),
});
```

**Permission Guard:** `git_commit` MUST be guarded (irreversible action). `git_branch` with `checkout=true` should also be guarded. `git_status`, `git_diff`, `git_log` can be unguarded (read-only).

#### Terminal UI

**Status output:**

```
  [GIT] Status (branch: <branch-name>)
  <renderer.table>
  | Status | File         |
  +--------+--------------+
  | M      | src/a.ts     |
  | M      | src/b.ts     |
  | ??     | src/new.ts   |
  | D      | src/old.ts   |
  +--------+--------------+

  <summary line>
```

Status indicator colors:

| Status | Meaning | Color |
|--------|---------|-------|
| `M` | Modified | Yellow |
| `A` | Added | Green |
| `D` | Deleted | Red |
| `??` | Untracked | Magenta |
| `R` | Renamed | Cyan |

**Commit output:**

```
  [GIT] Created commit:
    commit <hash>
    Author: <author> <<email>>
    Date:   <date>

        <message>

  Summary: <n> files changed, <n> insertions(+), <n> deletions(-)
```

**Log output:**

```
  [GIT] Recent commits (branch: <branch>)
  <renderer.table>
  | Hash      | Author | Age   | Message            |
  +-----------+--------+-------+--------------------+
  | abc1234   | user   | 2h    | fix: resolve bug   |
  | def5678   | user   | 1d    | feat: add feature  |
  +-----------+--------+-------+--------------------+
```

### 4.4 Success Criteria

1. [ ] `git_status` shows accurate branch name and file status
2. [ ] `git_diff` shows staged/unstaged diffs using the unified format from Feature A
3. [ ] `git_commit` creates a commit with proper message and authorship
4. [ ] `git_commit --all` stages all changes before committing
5. [ ] `git_log` shows formatted commit history
6. [ ] `git_branch` creates a branch (and optionally checks it out)
7. [ ] `git_add` stages specified files
8. [ ] All read-only operations (status, diff, log) are unguarded
9. [ ] Write operations (commit, branch) require permission guard approval
10. [ ] Error handling for: not a git repository, dirty working tree, merge conflicts, invalid branch names
11. [ ] Commands are safe from shell injection (use parameterized git subcommands, not string interpolation)
12. [ ] Test coverage for each tool (can use `git init` in temp directories)
13. [ ] Performance: status/diff/log complete in under 2 seconds even in large repositories

### 4.5 Edge Cases

- **Not a git repository:** Return error "Not a git repository"
- **Dirty working tree with checkout:** Refuse to checkout if there are uncommitted changes. Return "Uncommitted changes. Commit or stash first."
- **Git not installed:** Detect and return "git not found. Install git to use git tools."
- **Empty commits prevented:** By default reject `git commit` with no changes unless `allowEmpty=true`
- **Large diffs:** Truncate at the same 2000-line limit as Feature A
- **Binary files in status:** Show `M` status but skip binary content in diffs
- **Merge conflicts in progress:** `git_status` should show "MERGING" state
- **Detached HEAD:** Still works, just shows "(detached)" in branch display. The tool should still function but `git_branch` with `checkout` should not do anything destructive.
- **Long commit messages:** Cap display width at 72 characters for the summary line, with `...` truncation. The full message is always used in the commit itself.
- **SSH agent / GPG signing:** The tools use the user's existing git configuration transparently

### 4.6 Security Considerations

- **No credential handling:** The git tools NEVER handle credentials. They use the user's existing git configuration (SSH keys, credential helpers, GPG keys).
- **Shell injection prevention:** All user-provided parameters MUST be passed to git via `--argument=<value>` or as separate array elements, NEVER via string interpolation.
- **Repository scope:** Git operations must NOT escape the project directory. `--git-dir` and `--work-tree` should be explicitly set to the project's `.git`.
- **Commit message validation:** Messages over 200 characters are rejected at the schema level.

### 4.7 Files to Create/Modify

- **NEW:** `src/tools/git/tools.ts` -- All 5 tool factories: `createGitStatusTool()`, `createGitDiffTool()`, `createGitCommitTool()`, `createGitLogTool()`, `createGitBranchTool()`, `createGitAddTool()`
- **NEW:** `test/tools/git-tools.test.ts` -- Tests using temp git repositories
- **MODIFY:** `src/agent/index.ts` -- Register all git tools

---

## 5. Implementation Notes

### 5.1 Architecture Patterns

All three features follow the existing codebase patterns:

1. **Tool factory pattern** -- each tool is exported as `createXTool(): DynamicStructuredTool<typeof Schema>`
2. **Zod schema for validation** -- all parameters validated at the schema level
3. **Logger integration** -- `logger.info()` on invocation
4. **Error messages returned as strings** -- not thrown, returned for graceful degradation
5. **ASCII-only output** -- no Unicode, no emoji, no box-drawing chars
6. **ANSI color codes** -- using existing constants from `markdown.ts`

### 5.2 Permission Guard Integration

Batch Edit and Git Commit must be registered as sensitive operations:

```typescript
// After creating the tool:
registry.addTool(createBatchEditTool());
registry.setSensitive('batch_edit', true);
registry.setSensitive('git_commit', true);
```

(The PermissionGuard is already implemented in `src/tools/guard.ts` but not yet integrated into the agent flow. The Phase 2 integration work should be completed alongside these features.)

### 5.3 Diff Algorithm for Feature A

For file-to-file diffs, the algorithm should be:

1. Read both files via the existing `readTextFile()` from `os-compat`
2. Split into lines
3. Compute the diff using a simple LCS (Longest Common Subsequence) algorithm, OR shell out to `git diff --no-index` if available, falling back to an JS-based implementation
4. Format using `renderer.diffLine()`

**Recommendation:** Use `git diff --no-index` as the primary implementation for correctness (handles edge cases like trailing newlines better), with a fallback JS implementation. If using the JS fallback, a minimal Myers diff implementation (~50 lines) is sufficient.

### 5.4 Git Tool Implementation Approach

The git tools should shell out to the system `git` command (not use a JS git library):

```typescript
// Pattern for shelling out to git:
async function runGit(args: string[], cwd: string): Promise<string> {
  // Use the existing os-compat shell execution
  // Pass args as array to prevent shell injection
  const result = await exec('git', args, { cwd });
  return result.stdout;
}
```

This approach:
- Avoids adding a dependency on `isomorphic-git` or similar
- Uses the user's existing git configuration and credentials
- Works identically in Bun and Node.js
- Is simpler to test

### 5.5 Testing Approach

Each feature follows the existing test patterns (see `test/tools/`):

- **File Diff:** Read two temp files, compute diff, verify output format
- **Batch Edit:** Create temp files, apply batch edits, verify content, verify skipped files
- **Git Integration:** `git init` in a temp directory, create commits, verify status/diff/log

### 5.6 Migration Path

After all three features are implemented:

1. Phase 2 is fully complete
2. Phase 3 can begin: Streaming output, semantic search, MCP service mode, VS Code extension
3. Codebase stability allows for community contributions via proper documentation

---

*End of Phase 2 Feature Specifications*
