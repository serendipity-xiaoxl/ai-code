// ============================================================
// ai-code - File Tools
//
// LangChain DynamicStructuredTool implementations for file operations:
// - read: Read file contents with optional offset/limit
// - write: Create or overwrite files
// - edit: Line-level file editing (replace, insert, delete)
//
// All tools use Zod for parameter validation.
// ============================================================

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { readTextFile, writeTextFile, pathExists } from '../../utils/os-compat';
import { getLogger } from '../../utils/logger';

const logger = getLogger();

// ============================================================
// TOOL: read
// ============================================================

const ReadSchema = z.object({
  filePath: z.string().describe('Absolute or relative path to the file to read'),
  offset: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('Starting line number (0-based, default: 0)'),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Maximum number of lines to read (default: all)'),
});

/**
 * Create the read tool.
 * Reads a file with optional line offset and limit.
 */
export function createReadTool(): DynamicStructuredTool<typeof ReadSchema> {
  return new DynamicStructuredTool({
    name: 'read',
    description: 'Read the contents of a file with optional line offset and limit. ' +
      'Use this to view files in the project. ' +
      'You can specify offset and limit to read specific sections of large files.',
    schema: ReadSchema,
    func: async ({ filePath, offset, limit }: z.infer<typeof ReadSchema>) => {
      logger.info('read:', filePath);

      if (!pathExists(filePath)) {
        return 'Error: File not found: ' + filePath;
      }

      try {
        const content = await readTextFile(filePath);
        const lines = content.split('\n');

        const start = offset ?? 0;
        const end = limit ? start + limit : lines.length;
        const slice = lines.slice(start, end);

        const totalLines = lines.length;
        const header = `File: ${filePath} (${totalLines} lines)` +
          (limit ? `, showing lines ${start + 1}-${Math.min(end, totalLines)}` : '');
        const lineNumWidth = String(end).length;

        const body = slice
          .map((line, i) => {
            const lineNum = String(start + i + 1).padStart(lineNumWidth);
            return lineNum + ' |' + line;
          })
          .join('\n');

        return header + '\n' + body;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return 'Error reading file: ' + message;
      }
    },
  });
}

// ============================================================
// TOOL: write
// ============================================================

const WriteSchema = z.object({
  filePath: z.string().describe('Absolute or relative path of the file to write'),
  content: z.string().describe('The full content to write to the file'),
  append: z
    .boolean()
    .optional()
    .default(false)
    .describe('If true, append to existing file instead of overwriting'),
});

/**
 * Create the write tool.
 * Creates or overwrites a file with the given content.
 */
export function createWriteTool(): DynamicStructuredTool<typeof WriteSchema> {
  return new DynamicStructuredTool({
    name: 'write',
    description: 'Create a new file or overwrite an existing file with the given content. ' +
      'Use append=true to append to an existing file. ' +
      'Creates parent directories if they do not exist.',
    schema: WriteSchema,
    func: async ({ filePath, content, append }: z.infer<typeof WriteSchema>) => {
      logger.info('write:', filePath, append ? '(append)' : '');

      try {
        if (append && pathExists(filePath)) {
          const existing = await readTextFile(filePath);
          await writeTextFile(filePath, existing + '\n' + content);
          return 'Successfully appended ' + content.length + ' bytes to ' + filePath;
        }

        await writeTextFile(filePath, content);
        const lines = content.split('\n').length;
        return 'Successfully wrote ' + lines + ' lines (' + content.length + ' bytes) to ' + filePath;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return 'Error writing file: ' + message;
      }
    },
  });
}

// ============================================================
// TOOL: edit
// ============================================================

const EditSchema = z.object({
  filePath: z.string().describe('Absolute or relative path of the file to edit'),
  oldString: z
    .string()
    .describe('The exact text to find and replace (first occurrence only)'),
  newString: z.string().describe('The replacement text'),
  createIfMissing: z
    .boolean()
    .optional()
    .default(false)
    .describe('If true, create the file if it does not exist'),
});

/**
 * Create the edit tool.
 * Performs a find-and-replace on the first occurrence of oldString
 * in the specified file.
 */
export function createEditTool(): DynamicStructuredTool<typeof EditSchema> {
  return new DynamicStructuredTool({
    name: 'edit',
    description: 'Edit a file by finding and replacing text. ' +
      'Performs exact match find-and-replace on the first occurrence. ' +
      'Use this to make targeted changes to files. ' +
      'If createIfMissing is true, the file will be created if it does not exist.',
    schema: EditSchema,
    func: async ({
      filePath,
      oldString,
      newString,
      createIfMissing,
    }: z.infer<typeof EditSchema>) => {
      logger.info('edit:', filePath);

      if (!pathExists(filePath)) {
        if (createIfMissing) {
          await writeTextFile(filePath, newString);
          return 'Created new file ' + filePath;
        }
        return 'Error: File not found: ' + filePath;
      }

      try {
        const content = await readTextFile(filePath);

        const index = content.indexOf(oldString);
        if (index === -1) {
          return 'Error: Could not find the specified text in ' + filePath +
            '. The text must match exactly.';
        }

        const newContent =
          content.slice(0, index) +
          newString +
          content.slice(index + oldString.length);

        await writeTextFile(filePath, newContent);

        const oldLines = oldString.split('\n').length;
        const newLines = newString.split('\n').length;

        return 'Successfully edited ' + filePath +
          ' (replaced ' + oldLines + ' lines with ' + newLines + ' lines)';
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return 'Error editing file: ' + message;
      }
    },
  });
}
