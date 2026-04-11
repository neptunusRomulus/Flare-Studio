import fs from 'fs';
import path from 'path';

export type MarkdownFrontmatter = Record<string, unknown>;

export interface MarkdownRuleDoc {
  filePath: string;
  frontmatter: MarkdownFrontmatter;
}

export interface ValidationResult {
  filePath: string;
  valid: boolean;
  errors: string[];
}

const GLOB_META = /[*?\[\]{}]/;

export async function findMarkdownRuleDocs(root: string): Promise<MarkdownRuleDoc[]> {
  const searchDirectories = ['.github/instructions', '.github/agents'];
  const docs: MarkdownRuleDoc[] = [];

  for (const searchDir of searchDirectories) {
    const absoluteDir = path.resolve(root, searchDir);
    if (!fs.existsSync(absoluteDir)) {
      continue;
    }

    const entries = await fs.promises.readdir(absoluteDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) {
        continue;
      }

      const filePath = path.join(absoluteDir, entry.name);
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const frontmatter = parseMarkdownFrontmatter(content);
      docs.push({ filePath, frontmatter });
    }
  }

  return docs;
}

export function parseMarkdownFrontmatter(content: string): MarkdownFrontmatter {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return {};
  }

  const lines = match[1].split(/\r?\n/);
  const frontmatter: MarkdownFrontmatter = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const arrayMatch = line.match(/^([A-Za-z0-9_-]+):\s*\[(.*)\]$/);
    if (arrayMatch) {
      const key = arrayMatch[1];
      const rawArray = arrayMatch[2];
      let values: string[] = [];

      try {
        values = JSON.parse(`[${rawArray}]`);
      } catch {
        const parsedValues: string[] = [];
        let current = '';
        let quoteChar = '';
        let inQuotes = false;

        for (let index = 0; index < rawArray.length; index += 1) {
          const char = rawArray[index];
          if (!inQuotes && (char === '"' || char === "'")) {
            quoteChar = char;
            inQuotes = true;
            continue;
          }

          if (inQuotes && char === quoteChar) {
            parsedValues.push(current);
            current = '';
            inQuotes = false;
            quoteChar = '';
            continue;
          }

          if (!inQuotes && char === ',') {
            continue;
          }

          if (inQuotes) {
            current += char;
          }
        }

        values = parsedValues;
      }

      frontmatter[key] = values;
      continue;
    }

    const valueMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!valueMatch) {
      continue;
    }

    const key = valueMatch[1];
    let value = valueMatch[2].trim();
    if (value.startsWith(`"`) && value.endsWith(`"`)) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }

    frontmatter[key] = value;
  }

  return frontmatter;
}

export async function validateMarkdownRuleDocs(root: string): Promise<ValidationResult[]> {
  const docs = await findMarkdownRuleDocs(root);
  const results: ValidationResult[] = [];

  for (const doc of docs) {
    const errors: string[] = [];
    const applyTo = doc.frontmatter.applyTo;
    const isInstructionDoc = doc.filePath.includes(`${path.sep}.github${path.sep}instructions${path.sep}`);

    if (!applyTo) {
      if (isInstructionDoc) {
        errors.push('Missing required frontmatter key `applyTo`.');
      }
    } else if (!Array.isArray(applyTo) && typeof applyTo !== 'string') {
      errors.push('`applyTo` must be a string or array of strings.');
    }

    if (applyTo) {
      const patterns = Array.isArray(applyTo) ? applyTo : [applyTo];
      for (const rawPattern of patterns) {
        if (typeof rawPattern !== 'string') {
          errors.push('`applyTo` entry must be a string.');
          continue;
        }

        const normalized = rawPattern.trim();
        if (!normalized) {
          errors.push('`applyTo` contains an empty string.');
          continue;
        }

        const patternErrors = await validatePattern(root, normalized);
        errors.push(...patternErrors);
      }
    }

    results.push({ filePath: doc.filePath, valid: errors.length === 0, errors });
  }

  return results;
}

async function validatePattern(root: string, pattern: string): Promise<string[]> {
  const errors: string[] = [];
  const hasGlob = GLOB_META.test(pattern);
  const absolutePattern = path.resolve(root, pattern);

  if (!hasGlob) {
    if (!fs.existsSync(absolutePattern)) {
      errors.push(`Pattern does not resolve to an existing file: ${pattern}`);
    }
    return errors;
  }

  const allFiles = await listAllFiles(root);
  const matcher = new RegExp(`^${globToRegExp(pattern)}$`);
  const matches = allFiles.filter((relativePath) => matcher.test(relativePath));
  if (matches.length === 0) {
    errors.push(`Glob pattern did not match any file: ${pattern}`);
  }

  return errors;
}

function globToRegExp(pattern: string): string {
  const normalized = pattern.split(path.sep).join('/');

  const escapeRegex = (text: string) => text.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  let regex = '';

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];

    if (char === '*') {
      const nextChar = normalized[index + 1];
      if (nextChar === '*') {
        regex += '.*';
        index += 1;
      } else {
        regex += '[^/]*';
      }
      continue;
    }

    if (char === '?') {
      regex += '[^/]';
      continue;
    }

    if (char === '{') {
      const closing = normalized.indexOf('}', index + 1);
      if (closing > index) {
        const inner = normalized.slice(index + 1, closing);
        const parts = inner.split(',').map((part) => escapeRegex(part.trim()));
        regex += `(?:${parts.join('|')})`;
        index = closing;
        continue;
      }
    }

    regex += escapeRegex(char);
  }

  return regex;
}

async function listAllFiles(root: string): Promise<string[]> {
  const filePaths: string[] = [];

  async function crawl(directory: string) {
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', '.git', 'dist', 'release', 'archive', 'assets', 'public', 'test-results', 'playwright-report'].includes(entry.name)) {
          continue;
        }
        await crawl(absolutePath);
      } else if (entry.isFile()) {
        const relativePath = path.relative(root, absolutePath).split(path.sep).join('/');
        filePaths.push(relativePath);
      }
    }
  }

  await crawl(root);
  return filePaths;
}
