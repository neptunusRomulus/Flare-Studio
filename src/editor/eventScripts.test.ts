import { readFileSync, existsSync } from 'fs';
import { describe, expect, it } from 'vitest';
import {
  actionPropertiesFrom,
  collectScriptUsages,
  eventScriptRelPath,
  instancePropertiesFrom,
  mergeEventScript,
  normalizeEventScriptPath,
  parseEventScript,
  serializeEventScript,
} from './eventScripts';

const ADD0 = '/home/ism/Projects/Flare/flare-game/mods/empyrean_campaign/scripts/crafting/alchemy/add_0.txt';
const hasAdd0 = existsSync(ADD0);

describe('eventScripts', () => {
  it('builds a scripts/ path and normalizes references', () => {
    expect(eventScriptRelPath('Open Gate')).toBe('scripts/open_gate.txt');
    expect(normalizeEventScriptPath('open_gate')).toBe('scripts/open_gate.txt');
    expect(normalizeEventScriptPath('scripts/crafting/alchemy/init.txt')).toBe('scripts/crafting/alchemy/init.txt');
  });

  it('parses a two-step script, omits empty keys, and preserves comments when unchanged', () => {
    if (!hasAdd0) return;
    const text = readFileSync(ADD0, 'utf8');
    const parsed = parseEventScript(text);
    expect(parsed.header).toContain('# add an Empty Bottle');
    expect(parsed.steps).toEqual([
      { components: [
        { key: 'unset_status', value: 'emp_alchemy_0' },
        { key: 'set_status', value: 'emp_alchemy_slot0_0' },
      ] },
      { components: [{ key: 'script', value: 'scripts/crafting/alchemy/check_resources.txt' }] },
    ]);
    expect(mergeEventScript(text, parsed)).toBe(text);
    const next = {
      ...parsed,
      steps: [
        { ...parsed.steps[0], components: [...parsed.steps[0].components, { key: 'msg', value: '' }] },
        parsed.steps[1],
      ],
    };
    const written = mergeEventScript(text, next);
    expect(written).toContain('# add an Empty Bottle');
    expect(written).not.toContain('msg=');
  });

  it('serializes delay and splits instance keys from action keys', () => {
    const text = serializeEventScript({
      header: '# test',
      steps: [{ delay: '500ms', components: [{ key: 'set_status', value: 'open' }] }],
    });
    expect(text).toContain('# test');
    expect(text).toContain('delay=500ms');
    expect(text).toContain('set_status=open');
    const instance = instancePropertiesFrom({
      activate: 'on_trigger',
      location: '1,2,3,4',
      script: 'scripts/open.txt',
      set_status: 'should_not_be_instance',
    });
    expect(instance).toEqual({ activate: 'on_trigger', location: '1,2,3,4', script: 'scripts/open.txt' });
    expect(actionPropertiesFrom({
      activate: 'on_trigger',
      script: 'scripts/open.txt',
      set_status: 'open',
      reward_xp: '10',
    })).toEqual([
      { key: 'set_status', value: 'open' },
      { key: 'reward_xp', value: '10' },
    ]);
  });

  it('counts script= uses in maps, books, and chained scripts', () => {
    const uses = collectScriptUsages({
      'maps/town.txt': '[event]\nlocation=1,1,1,1\nscript=scripts/open_gate.txt\n',
      'books/note.txt': '[button]\nscript=scripts/open_gate.txt\n',
      'scripts/open_gate.txt': '[event]\nset_status=ok\n',
      'scripts/chain.txt': '[event]\nscript=scripts/open_gate.txt\n',
    });
    expect(uses.get('scripts/open_gate.txt')?.length).toBe(3);
  });

  it('counts two unsaved placements on the open map and ignores that map\'s saved file', () => {
    const uses = collectScriptUsages(
      {
        'maps/town.txt': '[event]\nscript=scripts/open_gate.txt\n[event]\nscript=scripts/open_gate.txt\n',
        'maps/cellar.txt': '[event]\nscript=scripts/open_gate.txt\n',
        'books/note.txt': 'script=scripts/open_gate.txt\n',
      },
      [
        {
          name: 'Town',
          objects: [
            { id: 1, type: 'event', properties: { script: 'scripts/open_gate.txt' } },
            { id: 2, type: 'event', properties: { script: 'scripts/open_gate.txt' } },
            { id: 3, type: 'npc', properties: { script: 'scripts/open_gate.txt' } },
          ],
        },
        {
          name: 'cellar',
          objects: [
            { id: 8, type: 'event', properties: { script: 'scripts/open_gate.txt' } },
          ],
        },
      ],
    );
    // 2 live town + 1 live cellar + 1 book. Saved town/cellar files are skipped.
    expect(uses.get('scripts/open_gate.txt')?.length).toBe(4);
  });

  it('drops a placement immediately when it is no longer in the live map', () => {
    const files = { 'maps/town.txt': '[event]\nscript=scripts/open_gate.txt\n' };
    const afterPlace = collectScriptUsages(files, [
      { name: 'town', objects: [{ id: 1, type: 'event', properties: { script: 'scripts/open_gate.txt' } }] },
    ]);
    const afterDelete = collectScriptUsages(files, [
      { name: 'town', objects: [] },
    ]);
    expect(afterPlace.get('scripts/open_gate.txt')?.length).toBe(1);
    expect(afterDelete.get('scripts/open_gate.txt') ?? []).toEqual([]);
  });
});
