import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const menus = require('../../electron/defaultMenus.cjs');

let roots: string[] = [];
const tempProject = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'flare-menus-'));
  roots.push(root);
  return root;
};

afterEach(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
  roots = [];
});

describe('default project menus', () => {
  it('ships the core editable menus', () => {
    const names = menus.defaultMenuNames();
    expect(names).toHaveLength(25);
    expect(names).not.toContain('npc.txt');
    expect(names).toEqual(expect.arrayContaining([
      'actionbar.txt',
      'character.txt',
      'inventory.txt',
      'hp.txt',
      'gametitle.txt',
      'gameload.txt',
      'gamenew.txt',
    ]));
  });

  it('copies menus into a new project without replacing existing files', () => {
    const root = tempProject();
    fs.mkdirSync(path.join(root, 'menus'), { recursive: true });
    fs.writeFileSync(path.join(root, 'menus', 'hp.txt'), 'pos=1,2,3,4\n');

    const result = menus.ensureDefaultMenus(root);
    expect(result.written).toContain('character.txt');
    expect(result.skipped).toContain('hp.txt');
    expect(fs.readFileSync(path.join(root, 'menus', 'hp.txt'), 'utf8')).toBe('pos=1,2,3,4\n');
  });

  it('can overwrite when explicitly requested', () => {
    const root = tempProject();
    fs.mkdirSync(path.join(root, 'menus'), { recursive: true });
    fs.writeFileSync(path.join(root, 'menus', 'hp.txt'), 'old\n');

    menus.ensureDefaultMenus(root, { overwrite: true });
    expect(fs.readFileSync(path.join(root, 'menus', 'hp.txt'), 'utf8')).not.toBe('old\n');
  });
});
