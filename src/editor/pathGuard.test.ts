import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isInsideRoot } from './pathGuard.cjs';

const root = path.join('/tmp', 'flare-project');

describe('isInsideRoot', () => {
  it('allows the project root and files inside it', () => {
    expect(isInsideRoot(root, root)).toBe(true);
    expect(isInsideRoot(root, path.join(root, 'maps', 'town.txt'))).toBe(true);
    expect(isInsideRoot(`${root}/`, path.join(root, 'project.json'))).toBe(true);
  });

  it('rejects siblings, prefix collisions, and parent escapes', () => {
    expect(isInsideRoot(root, path.join('/tmp', 'flare-project-evil', 'secret.txt'))).toBe(false);
    expect(isInsideRoot(root, path.join('/tmp', 'other', 'town.txt'))).toBe(false);
    expect(isInsideRoot(root, path.join(root, '..', 'etc', 'passwd'))).toBe(false);
    expect(isInsideRoot(root, path.join(root, 'maps', '..', '..', 'outside.txt'))).toBe(false);
  });

  it('rejects empty paths', () => {
    expect(isInsideRoot('', path.join(root, 'a.txt'))).toBe(false);
    expect(isInsideRoot(root, '')).toBe(false);
    expect(isInsideRoot(null, root)).toBe(false);
  });
});
