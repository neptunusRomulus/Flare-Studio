import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isInsideRoot, isInsideRootReal } from './pathGuard.cjs';

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

describe('isInsideRootReal', () => {
  function sandbox() {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'flare-guard-'));
    const project = path.join(base, 'project');
    const outside = path.join(base, 'outside');
    fs.mkdirSync(path.join(project, 'maps'), { recursive: true });
    fs.mkdirSync(outside, { recursive: true });
    fs.writeFileSync(path.join(outside, 'secret.txt'), 'x');
    return { base, project, outside };
  }

  it('accepts real paths inside the project, including files not created yet', () => {
    const { project } = sandbox();
    expect(isInsideRootReal(project, path.join(project, 'maps', 'town.txt'))).toBe(true);
    expect(isInsideRootReal(project, path.join(project, 'new-folder', 'draft.txt'))).toBe(true);
  });

  const symlinks = process.platform === 'win32' ? it.skip : it;

  symlinks('rejects a symlinked directory that points outside the project', () => {
    const { project, outside } = sandbox();
    fs.symlinkSync(outside, path.join(project, 'escape'));
    const sneaky = path.join(project, 'escape', 'secret.txt');
    expect(isInsideRoot(project, sneaky)).toBe(true);
    expect(isInsideRootReal(project, sneaky)).toBe(false);
  });

  symlinks('rejects a symlinked file that points outside the project', () => {
    const { project, outside } = sandbox();
    fs.symlinkSync(path.join(outside, 'secret.txt'), path.join(project, 'maps', 'link.txt'));
    expect(isInsideRootReal(project, path.join(project, 'maps', 'link.txt'))).toBe(false);
  });

  it('still rejects lexical escapes', () => {
    const { project, outside } = sandbox();
    expect(isInsideRootReal(project, path.join(outside, 'secret.txt'))).toBe(false);
    expect(isInsideRootReal(project, path.join(project, '..', 'outside', 'secret.txt'))).toBe(false);
  });
});
