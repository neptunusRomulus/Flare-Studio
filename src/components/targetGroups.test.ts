import { describe, it, expect } from 'vitest';
import { CONTENT_GROUP, ENTITY_GROUP, MAP_GROUP, collapseTargetGroups, cycleInGroup, groupOfType, normalizeTileRect, tabTargetFor, mainTabTargetFor } from './targetGroups';
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
    expect(tabTargetFor({ key: 'Tab' }, 'gameSettings', div)).toBeNull();
    expect(tabTargetFor({ key: 'Tab' }, 'rules', div)).toBe('items');
    expect(tabTargetFor({ key: 'Tab' }, 'items', div)).toBe('books');
    expect(tabTargetFor({ key: 'Tab' }, 'npc', { tagName: 'TEXTAREA' })).toBeNull();
    expect(tabTargetFor({ key: 'Tab' }, 'npc', { tagName: 'DIV', closest: () => ({}) })).toBeNull();
  });
  it('Shift+Tab cycles main layers Map -> Entities -> Content -> Game Settings -> Map', () => {
    const all = ['map', 'entities', 'content', 'gameSettings'];
    const sh = { key: 'Tab', shiftKey: true };
    expect(mainTabTargetFor(sh, 'collision', div, all)).toBe('entities');
    expect(mainTabTargetFor(sh, 'event', div, all)).toBe('content');
    expect(mainTabTargetFor(sh, 'status', div, all)).toBe('gameSettings');
    expect(mainTabTargetFor(sh, 'gameSettings', div, all)).toBe('map');
    expect(mainTabTargetFor(sh, 'items', div, ['map', 'entities', 'content'])).toBe('map');
    expect(mainTabTargetFor({ key: 'Tab' }, 'npc', div, all)).toBeNull();
    expect(mainTabTargetFor(sh, 'npc', { tagName: 'INPUT' }, all)).toBeNull();
    expect(mainTabTargetFor(sh, 'npc', { tagName: 'DIV', closest: () => ({}) }, all)).toBeNull();
    expect(MAP_GROUP.help).toBe('Tab: switch Ground, Object and Collision. Shift+Tab: switch main layers.');
  });
  it('sidebar: [Map] | [Entities] | [Items, Statuses, Quests] | [Game Settings]', () => {
    const types = ['gameSettings', 'rules', 'event', 'status', 'items', 'enemy', 'npc', 'object', 'collision', 'background'];
    const entries = collapseTargetGroups(groupLayers(types.map((type, id) => ({ id, type }))));
    const names = entries.map(e => e.kind === 'group' ? e.group.label : e.layer.type);
    expect(names).toEqual(['Map', 'Entities', 'Content', 'gameSettings']);
    const groupIdx = entries.map(e => layerGroupIndex(e.kind === 'group' ? e.targets[0].type : e.layer.type));
    expect(groupIdx).toEqual([0, 1, 2, 3]);
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
});
