import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  cardsFromNpcText,
  filterPropertyCatalog,
  listNpcPropertyCards,
  patchAddProperty,
  patchRemoveCard,
} from '@/editor/npcPropertyCards';

const FIXTURES = path.resolve(__dirname, '../../tests/fixtures/flare-npcs');

describe('npcPropertyCards from flare-game fixtures', () => {
  it('studio_edge.txt → intro voices, hidden minimap, stats, visual effect', () => {
    const text = fs.readFileSync(path.join(FIXTURES, 'studio_edge.txt'), 'utf8');
    const cards = cardsFromNpcText(text);
    const kinds = cards.map((c) => c.kind);
    expect(kinds.filter((k) => k === 'intro_voice')).toHaveLength(2);
    expect(kinds).toContain('minimap');
    expect(kinds.filter((k) => k === 'stat').length).toBeGreaterThanOrEqual(2);
    expect(kinds).toContain('visual_effect');
    expect(kinds).not.toContain('custom_animation');
    // Fixed category order: appear/map/audio before look/stats
    const categories = cards.map((c) => c.category);
    const firstStats = categories.indexOf('stats');
    const lastAudio = categories.lastIndexOf('audio');
    expect(lastAudio).toBeLessThan(firstStats);
    expect(cards.find((c) => c.kind === 'intro_voice')?.values.file).toContain('soundfx/npcs/a.ogg');
    expect(cards.find((c) => c.kind === 'visual_effect')?.values.id).toBe('glow');
  });

  it('loren.txt → intro voice from main section', () => {
    const text = fs.readFileSync(path.join(FIXTURES, 'loren.txt'), 'utf8');
    const cards = cardsFromNpcText(text);
    expect(cards.some((c) => c.kind === 'intro_voice' && c.values.file.includes('zombie_phys'))).toBe(true);
    // Dialog-only requires_status must not become spawn cards
    expect(cards.some((c) => c.kind === 'status')).toBe(false);
  });

  it('tutorial.txt with no optional props → empty property list', () => {
    const text = fs.readFileSync(path.join(FIXTURES, 'tutorial.txt'), 'utf8');
    expect(cardsFromNpcText(text)).toEqual([]);
  });

  it('synthetic top-level spawn keys become appear cards in fixed order', () => {
    const text = [
      'name=Guard',
      'requires_level=3',
      'requires_not_level=10',
      'requires_status=village_saved',
      'requires_not_status=dead',
      'requires_item=1001:1',
      'spawn_direction=2',
      'show_on_minimap=false',
      'vox_intro=hi.ogg',
      '',
      '[stats]',
      'speed=2',
    ].join('\n');
    const cards = cardsFromNpcText(text);
    expect(cards.map((c) => c.kind)).toEqual([
      'level',
      'status',
      'status',
      'item',
      'facing',
      'minimap',
      'intro_voice',
      'stat',
    ]);
    expect(cards.find((c) => c.kind === 'level')?.values).toEqual({ min: '3', max: '10' });
    expect(cards.filter((c) => c.kind === 'status').map((c) => c.polarity)).toEqual(['have', 'have_not']);
  });
});

describe('npcPropertyCards add/remove and catalog search', () => {
  it('add and remove level restores default (no card)', () => {
    const added = patchAddProperty('level', {});
    expect(added).toEqual({ requires_level: '' });
    const props = { ...added };
    const cards = listNpcPropertyCards({ properties: props });
    expect(cards.some((c) => c.kind === 'level')).toBe(true);
    const cleared = patchRemoveCard(cards.find((c) => c.kind === 'level')!, props);
    expect(cleared.requires_level).toBeNull();
    expect(cleared.requires_not_level).toBeNull();
  });

  it('search finds synonyms including Turkish seviye and voice', () => {
    const byLevel = filterPropertyCatalog('seviye', []);
    expect(byLevel.some((e) => e.kind === 'level')).toBe(true);
    const byVoice = filterPropertyCatalog('voice', []);
    expect(byVoice.some((e) => e.kind === 'intro_voice')).toBe(true);
    const byMinimap = filterPropertyCatalog('minimap', []);
    expect(byMinimap.some((e) => e.kind === 'minimap')).toBe(true);
  });

  it('custom animation card only when tileset is an imported image', () => {
    expect(listNpcPropertyCards({
      properties: { tilesetPath: 'animations/npcs/guild_man.txt' },
      customTileset: false,
    }).some((c) => c.kind === 'custom_animation')).toBe(false);
    expect(listNpcPropertyCards({
      properties: {
        tilesetPath: '/tmp/sheet.png',
        tilesetSourcePath: '/tmp/sheet.png',
        anim_render_width: '64',
      },
      customTileset: true,
    }).some((c) => c.kind === 'custom_animation')).toBe(true);
  });

  it('singleton kinds disappear from catalog once present', () => {
    const present = listNpcPropertyCards({ properties: { show_on_minimap: 'false' } });
    expect(filterPropertyCatalog('', present).some((e) => e.kind === 'minimap')).toBe(false);
    expect(filterPropertyCatalog('', present).some((e) => e.kind === 'status')).toBe(true);
  });

  it('facing uses the map direction key and migrates the legacy key', () => {
    expect(patchAddProperty('facing', {})).toEqual({ map_direction: '0' });
    const cards = listNpcPropertyCards({ properties: { map_direction: '2', spawn_direction: '5' } });
    const facing = cards.find((c) => c.kind === 'facing');
    expect(facing?.values.direction).toBe('2');
    expect(patchRemoveCard(facing!, { map_direction: '2' })).toEqual({ map_direction: null, spawn_direction: null });
    // legacy projects still show their facing value
    const legacy = listNpcPropertyCards({ properties: { spawn_direction: '3' } });
    expect(legacy.find((c) => c.kind === 'facing')?.values.direction).toBe('3');
  });

  it('waypoints card per route point and a wander radius card', () => {
    const props = { waypoints: '1,1\n2,2', wander_radius: '3' };
    const cards = listNpcPropertyCards({ properties: props });
    expect(cards.filter((c) => c.kind === 'waypoints').map((c) => c.values.point)).toEqual(['1,1', '2,2']);
    expect(cards.find((c) => c.kind === 'wander_radius')?.values.radius).toBe('3');
    expect(patchAddProperty('waypoints', { waypoints: '1,1' })).toEqual({ waypoints: '1,1\n', wander_radius: null });
    expect(patchAddProperty('wander_radius', { waypoints: '1,1' })).toEqual({ wander_radius: '1', waypoints: null });
    expect(patchRemoveCard(cards.find((c) => c.kind === 'wander_radius')!, props)).toEqual({ wander_radius: null });
  });
});
