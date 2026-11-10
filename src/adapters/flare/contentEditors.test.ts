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
  mergeQuestText,
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

  it('merges quest journal fields without dropping hand-written content', () => {
    const existing = [
      '# my notes',
      'name=Old Name',
      'complete_status=old_done',
      '',
      '[quest]',
      'requires_status=old_started',
      'requires_item=gold_key:2',
      'quest_text=Old text.',
      'custom_key=keep me',
      '',
      '[quest]',
      'requires_status=second',
      'quest_text=Second step.',
    ].join('\n');
    const merged = mergeQuestText(existing, {
      name: 'New Name',
      complete_status: 'new_done',
      requires_status: 'new_started',
      quest_text: 'New text.',
    });
    const lines = merged.split('\n');
    expect(lines).toContain('# my notes');
    expect(lines).toContain('name=New Name');
    expect(lines).toContain('complete_status=new_done');
    expect(lines).toContain('requires_status=new_started');
    expect(lines).toContain('quest_text=New text.');
    expect(lines).toContain('requires_item=gold_key:2');
    expect(lines).toContain('custom_key=keep me');
    expect(lines.filter((line) => line === 'quest_text=Second step.')).toHaveLength(1);
    expect(merged.indexOf('[quest]')).toBeLessThan(merged.indexOf('custom_key=keep me'));
  });

  it('writes first-stage journal requires and show_status without touching later stages', () => {
    const existing = [
      'name=Old Name',
      'complete_status=old_done',
      '',
      '[quest]',
      'requires_status=old_started',
      'requires_item=gold_key:2',
      'quest_text=Old text.',
      '',
      '[quest]',
      'requires_status=second',
      'requires_level=10',
      'quest_text=Second step.',
    ].join('\n');
    const merged = mergeQuestText(existing, {
      name: 'Old Name',
      complete_status: 'old_done',
      requires_status: 'old_started',
      quest_text: 'Old text.',
      requires_level: '3',
      requires_not_class: 'mage',
      requires_currency: '50',
      show_status: 'show_this',
    });
    expect(merged).toContain('requires_level=3');
    expect(merged).toContain('requires_not_class=mage');
    expect(merged).toContain('requires_currency=50');
    expect(merged).toContain('show_status=show_this');
    expect(merged).toContain('requires_item=gold_key:2');
    expect(merged).toContain('requires_status=second');
    expect(merged).toContain('requires_level=10');
    expect(merged).toContain('quest_text=Second step.');
    expect(merged.indexOf('requires_level=3')).toBeLessThan(merged.indexOf('requires_status=second'));
    const cleared = mergeQuestText(merged, {
      name: 'Old Name',
      complete_status: 'old_done',
      requires_status: 'old_started',
      quest_text: 'Old text.',
      requires_level: '',
    });
    expect(cleared).not.toContain('requires_level=3');
    expect(cleared).toContain('requires_level=10');
  });


  it('imports every [quest] block as a step and round-trips a real multi-stage journal unchanged', () => {
    const text = readFileSync(new URL('../../../tests/fixtures/flare-quests/0010_krolan.txt', import.meta.url), 'utf8');
    const imported = importQuestText(text) as { name: string; complete_status: string; quest_text: string; steps: Array<Record<string, unknown>> };
    expect(imported.name).toBe("Krolan's Missing");
    expect(imported.complete_status).toBe('emp_krolan_finish');
    expect(imported.steps).toHaveLength(3);
    expect(imported.steps[0].quest_text).toBe('Travel to the Perdition Mines and look for Krolan.');
    expect(imported.steps[1].requires_status).toBe('emp_krolan_key');
    expect(imported.steps[2].requires_not_status).toBe('emp_krolan_finish');
    expect(imported.quest_text).toBe(imported.steps[0].quest_text);
    expect(mergeQuestText(text, imported)).toBe(text);
    expect(exportQuestFile(imported).split('[quest]')).toHaveLength(4);
  });

  it('round-trips alchemy (items, trailing blank) and keeps unknown keys, comments and blanks', () => {
    const alchemy = readFileSync(new URL('../../../tests/fixtures/flare-quests/0011_alchemy.txt', import.meta.url), 'utf8');
    const imported = importQuestText(alchemy) as { steps: Array<Record<string, unknown>> };
    expect(imported.steps).toHaveLength(5);
    expect(imported.steps[4].requires_item).toBe('751:1,752:1,754:1');
    expect(mergeQuestText(alchemy, imported)).toBe(alchemy);

    const annotated = readFileSync(new URL('../../../tests/fixtures/flare-quests/krolan_annotated.txt', import.meta.url), 'utf8');
    const parsed = importQuestText(annotated) as { steps: Array<Record<string, unknown>> };
    const unchanged = mergeQuestText(annotated, parsed);
    expect(unchanged).toBe(annotated);
    expect(unchanged).toContain('# authored note');
    expect(unchanged).toContain('custom_header=keep');
    expect(unchanged).toContain('# first stage');
    expect(unchanged).toContain('custom_key=keep me');

    const reordered = {
      ...parsed,
      steps: [parsed.steps[2], parsed.steps[0], parsed.steps[1]],
    };
    const moved = mergeQuestText(annotated, reordered);
    expect(moved.indexOf('Return to Udana')).toBeLessThan(moved.indexOf('Travel to the Perdition Mines'));
    expect(moved).toContain('custom_key=keep me');
    expect(moved).toContain('# first stage');
    expect(moved).toContain('custom_header=keep');

    const trimmed = {
      ...parsed,
      steps: [parsed.steps[0], parsed.steps[1]],
    };
    const dropped = mergeQuestText(annotated, trimmed);
    expect(dropped).not.toContain('Return to Udana');
    expect(dropped).toContain('Use Krolan');
    expect(dropped).toContain('custom_key=keep me');

    const added = mergeQuestText(annotated, {
      ...parsed,
      steps: [
        ...parsed.steps,
        { quest_text: 'A fourth step.', requires_status: 'emp_krolan_finish', requires_not_status: 'emp_krolan_epilogue' },
      ],
    });
    expect(added).toContain('quest_text=A fourth step.');
    expect(added).toContain('custom_key=keep me');
  });

  it('creates a quest section for a new journal entry', () => {
    expect(mergeQuestText('', { name: 'Fresh', complete_status: 'done', quest_text: 'Do it.' }))
      .toBe(exportQuestFile({ name: 'Fresh', complete_status: 'done', quest_text: 'Do it.' }));
    const merged = mergeQuestText('APPEND\n', { name: 'Fresh', quest_text: 'Do it.' });
    expect(merged.startsWith('APPEND\n')).toBe(true);
    expect(merged).toContain('[quest]');
    expect(merged).toContain('quest_text=Do it.');
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
