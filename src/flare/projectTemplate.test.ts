import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ProjectStartToggle from '@/components/ProjectStartToggle';
import { queueTemplateImport, takeTemplateImport, isTemplateAvailable } from './projectTemplate';
import {
  MAX_LAYER_TABS,
  ensureActiveTab,
  nextEmptyTab,
  orderTemplateTilesets,
  type TilesetImportEditor,
} from '@/editor/importTileset';

const require = createRequire(import.meta.url);
const template = require('../../electron/flareTemplate.cjs');

function fakeInstall() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'flare-tpl-'));
  const root = path.join(base, 'squashfs-root');
  const data = path.join(root, 'usr', 'share', 'flare');
  const tilesets = path.join(data, 'mods', 'fantasycore', 'images', 'tilesets');
  fs.mkdirSync(path.join(data, 'mods', 'default'), { recursive: true });
  fs.mkdirSync(tilesets, { recursive: true });
  fs.writeFileSync(path.join(data, 'mods', 'fantasycore', 'settings.txt'), 'description=fantasycore\n');
  fs.writeFileSync(path.join(root, 'AppRun'), '');
  fs.writeFileSync(path.join(tilesets, 'tileset_grassland.png'), 'png');
  fs.writeFileSync(path.join(tilesets, 'tileset_cave.png'), 'png');
  fs.writeFileSync(path.join(tilesets, 'notes.txt'), 'x');
  fs.mkdirSync(path.join(tilesets, 'sub.png'));
  const outside = path.join(base, 'outside.png');
  fs.writeFileSync(outside, 'png');
  fs.symlinkSync(outside, path.join(tilesets, 'escape.png'));
  return { base, exe: path.join(root, 'AppRun'), data, tilesets };
}

describe('template tileset listing (main process)', () => {
  it('lists only PNG files inside fantasycore/images/tilesets of the resolved data path', () => {
    const { base, exe, data, tilesets } = fakeInstall();
    const listing = template.listTemplateTilesets(exe);
    expect(listing.ok).toBe(true);
    expect(listing.dataPath).toBe(data);
    expect(listing.dir).toBe(tilesets);
    expect(listing.files.map((f: { name: string }) => f.name)).toEqual(['tileset_cave.png', 'tileset_grassland.png']);
    fs.rmSync(base, { recursive: true, force: true });
  });

  it('is unavailable without an installed Flare or without fantasycore', () => {
    expect(template.listTemplateTilesets('').ok).toBe(false);
    expect(template.listTemplateTilesets('').error).toMatch(/Flare Modern or Flare Classic/);
    expect(template.listTemplateTilesets('/nope/AppRun').ok).toBe(false);
    const { base, exe, data } = fakeInstall();
    fs.rmSync(path.join(data, 'mods', 'fantasycore'), { recursive: true, force: true });
    expect(template.listTemplateTilesets(exe).ok).toBe(false);
    fs.rmSync(base, { recursive: true, force: true });
  });

  it('renderer check is false outside Electron or without a path', async () => {
    expect(await isTemplateAvailable(null)).toBe(false);
    expect(await isTemplateAvailable('/x/AppRun')).toBe(false);
  });
});

describe('template queue', () => {
  it('hands the Flare path to the matching project once', () => {
    queueTemplateImport('/p/a', '/f/AppRun');
    expect(takeTemplateImport('/p/b')).toBeNull();
    expect(takeTemplateImport('/p/a')).toBe('/f/AppRun');
    expect(takeTemplateImport('/p/a')).toBeNull();
  });
});

function fakeEditor(initialTabs = 1) {
  const tabs: Array<{ id: number; tileset?: unknown }> = [];
  let next = 1;
  let active: number | null = null;
  const editor: TilesetImportEditor = {
    getLayerTabs: () => tabs,
    getActiveLayerTabId: () => active,
    createLayerTab: () => { const id = next++; tabs.push({ id }); if (active === null) active = id; return id; },
    setActiveLayerTab: (_l, id) => { active = id; },
    importBrushImageToLayerTab: async () => {},
  };
  for (let i = 0; i < initialTabs; i++) editor.createLayerTab('background');
  return { editor, tabs };
}

describe('tab use for imports', () => {
  it('fills the empty starting tab first, then adds tabs up to the limit', () => {
    const { editor, tabs } = fakeEditor(1);
    const used: Array<number | null> = [];
    for (let i = 0; i < MAX_LAYER_TABS + 3; i++) {
      const id = nextEmptyTab(editor, 'background');
      used.push(id);
      if (id !== null) tabs.find((t) => t.id === id)!.tileset = {};
    }
    expect(used.filter((x) => x !== null)).toHaveLength(MAX_LAYER_TABS);
    expect(used[0]).toBe(1);
    expect(used.slice(MAX_LAYER_TABS)).toEqual([null, null, null]);
  });

  it('manual import uses the active tab, or creates one', () => {
    const { editor } = fakeEditor(0);
    expect(ensureActiveTab(editor, 'background')).toBe(1);
    expect(ensureActiveTab(editor, 'background')).toBe(1);
  });

  it('orders the common tilesets first', () => {
    const names = ['tileset_snowplains_other.png', 'tileset_cave.png', 'tileset_grassland_water.png', 'tileset_grassland.png', 'tileset_dungeon.png']
      .map((name) => ({ name }));
    expect(orderTemplateTilesets(names).map((f) => f.name)).toEqual([
      'tileset_grassland.png', 'tileset_grassland_water.png', 'tileset_dungeon.png', 'tileset_cave.png', 'tileset_snowplains_other.png',
    ]);
  });
});

describe('Start from scratch / Start with template', () => {
  it('renders both buttons; template is disabled without Flare', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProjectStartToggle, { value: 'scratch', onChange: () => {}, templateAvailable: false }),
    );
    expect(html).toContain('Start from scratch');
    expect(html).toContain('Start with template');
    expect(html).toMatch(/data-testid="project-start-template"[^>]*aria-disabled="true"|aria-disabled="true"[^>]*data-testid="project-start-template"/);
    expect(html).not.toContain('You import your own tilesets');
  });

  it('template is enabled and selectable with Flare', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProjectStartToggle, { value: 'template', onChange: () => {}, templateAvailable: true }),
    );
    expect(html).not.toContain('aria-disabled');
    expect(html).toMatch(/aria-checked="true"[^>]*data-testid="project-start-template"|data-testid="project-start-template"[^>]*aria-checked="true"/);
  });
});
