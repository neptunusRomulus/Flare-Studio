import { describe, it, expect } from 'vitest';
import { CONTENT_GROUP, ENTITY_GROUP, MAP_GROUP, collapseTargetGroups, cycleInGroup, groupOfType, normalizeTileRect, railGroups, railHelpFor, tabTargetFor, mainTabTargetFor, visibilityTargets } from './targetGroups';
import { groupLayers, layerGroupIndex } from './layerGroups';

const div = { tagName: 'DIV', closest: () => null };

describe('target groups', () => {
  it('entity cycling NPC -> Enemy -> Event -> NPC and reverse', () => {
    expect(cycleInGroup(ENTITY_GROUP, 'npc')).toBe('enemy');
    expect(cycleInGroup(ENTITY_GROUP, 'enemy')).toBe('event');
    expect(cycleInGroup(ENTITY_GROUP, 'event')).toBe('npc');
    expect(cycleInGroup(ENTITY_GROUP, 'npc', true)).toBe('event');
  });
  it('Tab stays inside the active group', () => {
    expect(tabTargetFor({ key: 'Tab' }, 'enemy', div)).toBe('event');
    expect(tabTargetFor({ key: 'Tab' }, 'object', div)).toBe('collision');
    expect(tabTargetFor({ key: 'Tab', shiftKey: true }, 'npc', div)).toBeNull();
    expect(tabTargetFor({ key: 'Tab' }, 'gameSettings', div)).toBe('worldSettings');
    expect(tabTargetFor({ key: 'Tab' }, 'worldSettings', div)).toBe('gameSettings');
    expect(tabTargetFor({ key: 'Tab' }, 'strings', div)).toBe('worldSettings');
    expect(tabTargetFor({ key: 'Tab' }, 'titles', div)).toBe('stats');
    expect(tabTargetFor({ key: 'Tab' }, 'stats', div)).toBe('powerTree');
    expect(tabTargetFor({ key: 'Tab' }, 'powerTree', div)).toBe('titles');
    expect(tabTargetFor({ key: 'Tab' }, 'rules', div)).toBe('items');
    expect(tabTargetFor({ key: 'Tab' }, 'items', div)).toBe('books');
    expect(tabTargetFor({ key: 'Tab' }, 'npc', { tagName: 'TEXTAREA' })).toBeNull();
    expect(tabTargetFor({ key: 'Tab' }, 'npc', { tagName: 'DIV', closest: () => ({}) })).toBeNull();
  });
  it('Shift+Tab cycles main layers Map -> Entities -> Content -> Settings -> Character -> Map', () => {
    const all = ['map', 'entities', 'content', 'settings', 'character'];
    const sh = { key: 'Tab', shiftKey: true };
    expect(mainTabTargetFor(sh, 'collision', div, all)).toBe('entities');
    expect(mainTabTargetFor(sh, 'event', div, all)).toBe('content');
    expect(mainTabTargetFor(sh, 'status', div, all)).toBe('settings');
    expect(mainTabTargetFor(sh, 'gameSettings', div, all)).toBe('character');
    expect(mainTabTargetFor(sh, 'worldSettings', div, all)).toBe('character');
    expect(mainTabTargetFor(sh, 'strings', div, all)).toBe('character');
    expect(mainTabTargetFor(sh, 'titles', div, all)).toBe('map');
    expect(mainTabTargetFor(sh, 'stats', div, all)).toBe('map');
    expect(mainTabTargetFor(sh, 'powerTree', div, all)).toBe('map');
    expect(mainTabTargetFor(sh, 'items', div, ['map', 'entities', 'content'])).toBe('map');
    expect(mainTabTargetFor({ key: 'Tab' }, 'npc', div, all)).toBeNull();
    expect(mainTabTargetFor(sh, 'npc', { tagName: 'INPUT' }, all)).toBeNull();
    expect(mainTabTargetFor(sh, 'npc', { tagName: 'DIV', closest: () => ({}) }, all)).toBeNull();
    expect(MAP_GROUP.help).toBe('Tab: switch Ground, Object and Collision. Shift+Tab: switch main layers.');
  });
  it('sidebar: [Map] | [Entities] | [Content] | [Settings] | strings leftover | [Character]', () => {
    const types = ['powerTree', 'stats', 'titles', 'strings', 'worldSettings', 'gameSettings', 'rules', 'event', 'status', 'items', 'enemy', 'npc', 'object', 'collision', 'background'];
    const entries = collapseTargetGroups(groupLayers(types.map((type, id) => ({ id, type }))));
    const names = entries.map(e => e.kind === 'group' ? e.group.label : e.layer.type);
    expect(names).toEqual(['Map', 'Entities', 'Content', 'Settings', 'strings', 'Character']);
    const groupIdx = entries.map(e => layerGroupIndex(e.kind === 'group' ? e.targets[0].type : e.layer.type));
    expect(groupIdx).toEqual([0, 1, 2, 3, 3, 4]);
    expect(groupOfType('event')).toBe(ENTITY_GROUP);
    expect(groupOfType('collision')).toBe(MAP_GROUP);
  });
  it('content cycling Items -> Books -> Statuses -> Quests -> Items, no visibility', () => {
    expect(cycleInGroup(CONTENT_GROUP, 'items')).toBe('books');
    expect(cycleInGroup(CONTENT_GROUP, 'books')).toBe('status');
    expect(cycleInGroup(CONTENT_GROUP, 'status')).toBe('rules');
    expect(cycleInGroup(CONTENT_GROUP, 'rules')).toBe('items');
    expect(cycleInGroup(CONTENT_GROUP, 'items', true)).toBe('rules');
    expect(groupOfType('status')).toBe(CONTENT_GROUP);
    expect(CONTENT_GROUP.hasVisibility).toBe(false);
  });
  it('normalises event rectangles', () => {
    expect(normalizeTileRect({ x: 5, y: 7 }, { x: 2, y: 3 }, 20, 20)).toEqual({ x: 2, y: 3, width: 4, height: 5 });
    expect(normalizeTileRect({ x: 4, y: 4 }, { x: 4, y: 4 }, 20, 20)).toEqual({ x: 4, y: 4, width: 1, height: 1 });
    expect(normalizeTileRect({ x: -3, y: 2 }, { x: 25, y: 2 }, 20, 10)).toEqual({ x: 0, y: 2, width: 20, height: 1 });
  });
  it('rail groups list Map / Entities / Content / Settings / Character and omit Localization', () => {
    const groups = railGroups([
      { type: 'background' },
      { type: 'collision' },
      { type: 'npc' },
      { type: 'event' },
      { type: 'items' },
      { type: 'gameSettings' },
      { type: 'worldSettings' },
      { type: 'strings' },
      { type: 'titles' },
      { type: 'stats' },
      { type: 'powerTree' },
    ]);
    expect(groups.map((g) => g.id)).toEqual(['map', 'entities', 'content', 'settings', 'character']);
    expect(groups[3].label).toBe('Settings');
    expect(groups[3].targets.map((t) => t.type)).toEqual(['gameSettings', 'worldSettings']);
    expect(groups[3].targets.map((t) => t.label)).toEqual(['UI Settings', 'World Settings']);
    expect(groups[4].label).toBe('Character');
    expect(groups[4].targets.map((t) => t.type)).toEqual(['titles', 'stats', 'powerTree']);
    expect(groups[4].targets.map((t) => t.label)).toEqual(['Titles', 'Stats', 'Power Tree']);
    expect(groups[0].targets.map((t) => t.type)).toEqual(['background', 'collision']);
    expect(groups[1].targets.map((t) => t.type)).toEqual(['npc', 'event']);
    expect(groups[2].targets.map((t) => t.type)).toEqual(['items']);
    expect(groups[2].label).toBe('Content');
    expect(groups.some((g) => g.targets.some((t) => t.type === 'strings'))).toBe(false);
  });
  it('rail visibility icons cover Map and Entities only', () => {
    const targets = visibilityTargets([
      { type: 'background' },
      { type: 'object' },
      { type: 'collision' },
      { type: 'npc' },
      { type: 'enemy' },
      { type: 'event' },
      { type: 'items' },
      { type: 'rules' },
      { type: 'gameSettings' },
      { type: 'worldSettings' },
      { type: 'strings' },
      { type: 'titles' },
      { type: 'stats' },
    ]);
    expect(targets.map((t) => t.type)).toEqual(['background', 'object', 'collision', 'npc', 'enemy', 'event']);
  });
  it('bottom ? tip keeps group Tab help and adds visibility gestures once', () => {
    const help = railHelpFor('titles');
    expect(help).toContain('Tab: switch Titles, Stats and Power Tree. Shift+Tab: switch main layers.');
    expect(help).toContain('Ctrl+Click: hide/unhide');
    expect(help).toContain('Mouse wheel: adjust opacity');
    expect(help.match(/Shift\+Tab/g)?.length).toBe(1);
    expect(railHelpFor('strings')).toContain('Tab: switch UI Settings and World Settings');
  });
});
