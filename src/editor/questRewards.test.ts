import { describe, expect, it } from 'vitest';
import { applyWhenDoneRewards, findTurnInTarget, listMapEvents, rewardsFromWhenDone } from './questRewards';

const npc = `# merchant
name=Merchant

[dialog]
id=quest_krolan_turnin
him=You found it.
requires_status=krolan_open

[dialog]
id=chat
him=Hello.
`;

const map = `[header]
title=Town

[event]
type=event
location=4,5,1,1
id=turnin_spot
msg=Done

[event]
type=event
location=1,1,1,1
intermap=maps/cave.txt,2,2
`;

describe('questRewards', () => {
  it('finds the generated turn-in dialog, falling back to set_status', () => {
    const files = { 'npcs/merchant.txt': npc };
    expect(findTurnInTarget(files, 'krolan', 'krolan_done')).toEqual({
      kind: 'npc',
      path: 'npcs/merchant.txt',
      dialogueId: 'quest_krolan_turnin',
    });
    const other = {
      'npcs/other.txt': `[dialog]\nid=legacy\nhim=ok\nset_status=krolan_done\n`,
    };
    expect(findTurnInTarget(other, 'missing', 'krolan_done')?.path).toBe('npcs/other.txt');
    expect(findTurnInTarget({}, 'krolan')).toBeNull();
  });

  it('writes reward keys into the turn-in dialog and keeps the file identical when unchanged', () => {
    const files = { 'npcs/merchant.txt': npc };
    const rewards = rewardsFromWhenDone({
      set_status: 'krolan_done',
      xp: '150',
      currency: '10',
      items: [{ id: '5', quantity: '1' }],
    });
    const first = applyWhenDoneRewards(
      files,
      { kind: 'npc', path: 'npcs/merchant.txt', dialogueId: 'quest_krolan_turnin' },
      rewards,
    );
    expect(first.changed).toBe(true);
    expect(first.files['npcs/merchant.txt']).toContain('id=quest_krolan_turnin');
    expect(first.files['npcs/merchant.txt']).toContain('set_status=krolan_done');
    expect(first.files['npcs/merchant.txt']).toContain('reward_xp=150');
    expect(first.files['npcs/merchant.txt']).toContain('reward_currency=10');
    expect(first.files['npcs/merchant.txt']).toContain('reward_item=5:1');
    expect(first.files['npcs/merchant.txt']).toContain('id=chat');
    expect(first.files['npcs/merchant.txt']).toContain('# merchant');
    const second = applyWhenDoneRewards(first.files, first.files && { kind: 'npc', path: 'npcs/merchant.txt', dialogueId: 'quest_krolan_turnin' }, rewards);
    expect(second.changed).toBe(false);
    expect(second.files['npcs/merchant.txt']).toBe(first.files['npcs/merchant.txt']);
  });

  it('writes rewards onto a picked map event', () => {
    const files = { 'maps/town.txt': map };
    const events = listMapEvents(files);
    expect(events[0]).toMatchObject({ path: 'maps/town.txt', eventKey: 'turnin_spot' });
    const next = applyWhenDoneRewards(
      files,
      { kind: 'event', path: 'maps/town.txt', eventKey: 'turnin_spot' },
      { reward_xp: '20', set_status: 'done' },
    );
    expect(next.changed).toBe(true);
    expect(next.files['maps/town.txt']).toContain('id=turnin_spot');
    expect(next.files['maps/town.txt']).toContain('reward_xp=20');
    expect(next.files['maps/town.txt']).toContain('set_status=done');
    expect(next.files['maps/town.txt']).toContain('intermap=maps/cave.txt,2,2');
    expect(next.files['maps/town.txt']).not.toMatch(/intermap[\s\S]*reward_xp/);
  });
});
