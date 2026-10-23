import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  exportCutsceneFile,
  exportEffectFile,
  exportEngineText,
  exportFogMask,
  exportItemQualitiesFile,
  exportItemSetsFile,
  exportItemTypesFile,
  exportLanguagePot,
  exportLootFile,
  exportMapText,
  exportParallaxFile,
  exportProcgenRules,
  exportQuestFile,
  importEngineText,
  importQuestText,
  mergePowerText,
  validateText,
} from './flareAdapter.cjs';
import { clipboardFromTiles, pasteTileGrid } from '../../editor/tileClipboard';
import { collectStatusReferences } from '../../editor/statusIndex';

const fixture = (name: string) => readFileSync(new URL(`../../../tests/fixtures/export/${name}`, import.meta.url), 'utf8');

describe('content editor exports', () => {
  it('writes a loot table to the engine loot format', () => {
    const text = exportLootFile({
      id: 'loot_chest',
      name: 'Loot Chest',
      description: 'Test loot group',
      loot_chance_value: '0.75',
      requires_status: 'gold_key',
      requires_level: '2,5',
      quantity_per_level: '1,2',
      loot_contents: { '1': 2 },
    });
    expect(text).toBe(fixture('chest.loot.txt'));
    expect(validateText('loot', text, 'loot/chest.txt')).toEqual([]);
  });

  it('writes every quest field and reads it back', () => {
    const text = exportQuestFile({
      name: 'Find the Key',
      complete_status: 'key_found',
      requires_status: 'talked_to_guard',
      requires_not_status: 'key_found',
      requires_level: '2',
      requires_not_level: '99',
      requires_currency: '10',
      requires_not_currency: '0',
      requires_class: 'warrior',
      requires_not_class: 'mage',
      quest_text: 'Find the cellar key.',
      itemRequirements: [
        { type: 'requires_item', itemId: 'gold_key', itemQuantity: 2 },
        { type: 'requires_not_item', itemId: 'fake_key', itemQuantity: 1 },
      ],
    });
    expect(text).toBe(fixture('find_the_key.quest.txt'));
    expect(validateText('quests', text, 'quests/find_the_key.txt')).toEqual([]);
    const imported = importQuestText(text) as { itemRequirements: Array<{ itemId: string; itemQuantity: number }> };
    expect(imported.itemRequirements[0]).toMatchObject({ itemId: 'gold_key', itemQuantity: 2 });
  });

  it('writes powers/effects.txt, item types, qualities and sets', () => {
    const effect = exportEffectFile([{ id: 'burn', type: 'damage', name: 'Burn', can_stack: true, max_stacks: 3 }]);
    expect(effect).toBe(fixture('burn.effect.txt'));
    expect(validateText('effects', effect, 'powers/effects.txt')).toEqual([]);

    const types = exportItemTypesFile({ sortOrder: 'consumable,gem', types: [{ id: 'gem', name: 'Gem', auto_pickup: true }] });
    expect(types).toBe(fixture('gem.types.txt'));
    expect(validateText('item_types', types, 'items/types.txt')).toEqual([]);

    const qualities = exportItemQualitiesFile({ sortOrder: 'normal,magic', qualities: [{ id: 'magic', name: 'Magic', color: '80,80,255' }] });
    expect(qualities).toBe(fixture('magic.qualities.txt'));
    expect(validateText('items', qualities, 'items/qualities.txt')).toEqual([]);

    const sets = exportItemSetsFile([{ id: 1, name: 'Twin Blades', items: 'sword,dagger', color: '255,255,255', bonus: ['2,dmg,5'], bonus_power_level: ['2,12,1'] }]);
    expect(sets).toBe(fixture('twin_blades.sets.txt'));
    expect(validateText('item_sets', sets, 'items/sets.txt')).toEqual([]);
  });

  it('keeps an existing power block when appending another', () => {
    const merged = mergePowerText('# authored\nAPPEND\n\n[power]\nid=1\nname=Old\ncustom_note=keep\n', [{ id: '2', name: 'New', type: 'fixed' }]);
    expect(merged).toContain('custom_note=keep');
    expect(merged).toContain('id=2');
    expect(merged).toContain('name=New');
  });

  it('round-trips a sectionless engine file without inventing a section', () => {
    const original = fixture('playtest.engine.txt');
    expect(exportEngineText(importEngineText(original))).toBe(original);
    expect(exportEngineText(importEngineText(original))).not.toContain('[]');
  });

  it('writes cutscene, language pot, parallax, fog and procgen files', () => {
    const cutscene = exportCutsceneFile({
      caption_margins: '10,10',
      music: 'music/intro.ogg',
      scenes: [{ caption: 'Hello', image: 'images/intro.png,2', pause: '2s' }],
      vscroll: [{ text: 'The end', image: 'images/credits.png', separator: 8 }],
    });
    expect(cutscene).toBe(fixture('intro.cutscene.txt'));
    expect(validateText('cutscenes', cutscene)).toEqual([]);

    expect(exportLanguagePot(['Find the Key', 'Find the cellar key.', 'Find the Key'])).toBe(fixture('project.pot'));

    const parallax = exportParallaxFile([{ image: 'images/sky.png', speed: '0.2', map_layer: 'background' }]);
    expect(parallax).toBe(fixture('sky.parallax.txt'));
    expect(validateText('parallax', parallax)).toEqual([]);

    const fog = exportFogMask({
      radius: 4,
      bits_per_tile: 4,
      bits: ['BIT_0,0', 'BIT_N,1'],
      tiles: ['ALL,BIT_0,BIT_N'],
      data: 'ALL,ALL\nALL,ALL',
    });
    expect(fog).toBe(fixture('mask.fow.txt'));
    expect(validateText('fog', fog)).toEqual([]);

    const rules = exportProcgenRules({
      doors_max: 3,
      main_path_length_min: 4,
      main_path_length_max: 8,
      chunks: ['maps/chunks/start.txt', 'maps/chunks/hall.txt'],
    });
    expect(rules).toBe(fixture('dungeon.procgen.txt'));
    expect(validateText('procgen', rules)).toEqual([]);
  });

  it('writes fog of war keys on the map header', () => {
    const exported = exportMapText({ width: 1, height: 1, heroX: 0, heroY: 0, fogofwar: 1, save_fogofwar: true, layers: [] });
    expect(exported.text).toContain('fogofwar=1');
    expect(exported.text).toContain('save_fogofwar=true');
    expect(exported.errors).toEqual([]);
  });
});

describe('status cross-reference and tile paste', () => {
  it('lists who sets and who reads a status', () => {
    const index = collectStatusReferences([
      { source: 'quest:key', value: { complete_status: 'key_found', requires_status: 'talked_to_guard' } },
      { source: 'event:door', value: { set_status: 'door_open', requires_status: 'key_found' } },
    ]);
    expect(index.key_found.setBy).toEqual(['quest:key']);
    expect(index.key_found.readBy).toEqual(['event:door']);
    expect(index.talked_to_guard.readBy).toEqual(['quest:key']);
    expect(index.door_open.setBy).toEqual(['event:door']);
  });

  it('pastes a copied tile region onto another origin', () => {
    const clipboard = clipboardFromTiles([
      { x: 2, y: 1, gid: 4, tilesetKey: 'ground.png' },
      { x: 3, y: 1, gid: 5, tilesetKey: null },
    ]);
    expect(clipboard).not.toBeNull();
    const pasted = pasteTileGrid([0, 0, 0, 0, 0, 0], 3, 2, clipboard!, 0, 0);
    expect(pasted.data).toEqual([4, 5, 0, 0, 0, 0]);
    expect(pasted.tilesetWrites).toEqual([
      { index: 0, key: 'ground.png' },
      { index: 1, key: null },
    ]);
  });
});
