import path from 'path';
import { describe, it, expect } from 'vitest';
import { validateMarkdownRuleDocs } from './utils/markdownRuleValidator';

const projectRoot = path.resolve(process.cwd());

describe('Logic Test', () => {
  it('should validate frontmatter and applyTo patterns for documented rules', async () => {
    const results = await validateMarkdownRuleDocs(projectRoot);
    const failures = results.filter((result) => !result.valid);

    if (failures.length > 0) {
      const messages = failures
        .map((failure) => `\n${path.relative(projectRoot, failure.filePath)}:\n  - ${failure.errors.join('\n  - ')}`)
        .join('');
      throw new Error(`Markdown rule validation failed:${messages}`);
    }

    expect(failures).toHaveLength(0);
  });
});