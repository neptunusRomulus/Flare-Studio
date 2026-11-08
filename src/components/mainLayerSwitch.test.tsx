import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { mainLayerOf, mainLayerTargetId, rememberGroupTarget, ENTITY_GROUP, MAIN_LAYERS } from './targetGroups';
import MainLayerSwitch from './MainLayerSwitch';
import MapTargetSwitch, { visibilityTooltip } from './MapTargetSwitch';
import type { TileLayer } from '@/types';

const L = (id: number, type: string, visible = true, transparency = 0) => ({ id, type, name: type, data: [], visible, transparency }) as unknown as TileLayer;
const layers = [L(1, 'background'), L(2, 'object'), L(3, 'collision'), L(4, 'npc'), L(5, 'enemy'), L(6, 'event', false, 0.3), L(7, 'items'), L(8, 'status'), L(9, 'rules'), L(10, 'gameSettings')];
const noop = () => {};

describe('main layer switch', () => {
  it('orders Map | Entities | Content | Game Settings', () => {
    expect(MAIN_LAYERS.map(m => m.label)).toEqual(['Map', 'Entities', 'Content', 'Game Settings']);
  });
  it('maps layer types to main layers', () => {
    expect(mainLayerOf('collision')).toBe('map');
    expect(mainLayerOf('event')).toBe('entities');
    expect(mainLayerOf('rules')).toBe('content');
    expect(mainLayerOf('gameSettings')).toBe('gameSettings');
    expect(mainLayerOf(null)).toBeNull();
  });
  it('activates the last-used target of a group', () => {
    expect(mainLayerTargetId('content', layers)).toBe(7);
    rememberGroupTarget(ENTITY_GROUP, 'enemy');
    expect(mainLayerTargetId('entities', layers)).toBe(5);
    expect(mainLayerTargetId('gameSettings', layers)).toBe(10);
    expect(mainLayerTargetId('gameSettings', layers.slice(0, 3))).toBeNull();
  });
  it('renders four square buttons with the active one pressed', () => {
    const html = renderToStaticMarkup(<MainLayerSwitch layers={layers} activeLayer={layers[7]} onSelectLayer={noop} />);
    expect((html.match(/aria-pressed/g) || []).length).toBe(4);
    expect(html).toContain('aria-label="Content" aria-pressed="true"');
  });
});

describe('sub-switch visibility', () => {
  it('formats the tooltip', () => {
    expect(visibilityTooltip('Event', false, 0.3)).toBe('Event · hidden · opacity 70% (wheel)');
  });
  it('adds a corner eye per target only when visibility controls are given', () => {
    const vis = { onToggleVisibility: noop, onTransparencyChange: noop };
    const withVis = renderToStaticMarkup(<MapTargetSwitch group={ENTITY_GROUP} layers={layers} activeLayer={layers[3]} onSelectLayer={noop} visibility={vis} />);
    expect(withVis).toContain('aria-label="Show Event"');
    expect(withVis).toContain('aria-label="Hide NPC"');
    expect(withVis).toContain('opacity:0.4');
    const plain = renderToStaticMarkup(<MapTargetSwitch group={ENTITY_GROUP} layers={layers} activeLayer={layers[3]} onSelectLayer={noop} />);
    expect(plain).not.toContain('Hide NPC');
  });
});
