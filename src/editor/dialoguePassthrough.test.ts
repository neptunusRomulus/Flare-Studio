import { describe, expect, it } from 'vitest';
import {
  allowMovementOf,
  groundLootCountOf,
  lootCountOf,
  takePartyOf,
  withAllowMovement,
  withGroundLootCount,
  withLootCount,
  withTakeParty,
} from '@/editor/dialoguePassthrough';

describe('dialoguePassthrough', () => {
  it('treats missing allow_movement as allowed, and omits the key when leaving the default', () => {
    expect(allowMovementOf({})).toBe(true);
    expect(withAllowMovement({}, true)).toEqual([]);
    expect(withAllowMovement({}, false)).toEqual([{ key: 'allow_movement', value: 'false' }]);
    const off = { passthrough: [{ key: 'allow_movement', value: 'false' }] };
    expect(allowMovementOf(off)).toBe(false);
    expect(withAllowMovement(off, true)).toEqual([{ key: 'allow_movement', value: 'true' }]);
  });

  it('only writes take_a_party when the NPC should join', () => {
    expect(takePartyOf({})).toBe(false);
    expect(withTakeParty({}, false)).toEqual([]);
    expect(withTakeParty({}, true)).toEqual([{ key: 'take_a_party', value: 'true' }]);
    expect(takePartyOf({ passthrough: [{ key: 'take_a_party', value: 'true' }] })).toBe(true);
  });

  it('stores loot counts as min or min,max and drops the key when cleared', () => {
    const tree = { passthrough: [{ key: 'keep', value: '1' }] };
    expect(lootCountOf(tree)).toEqual({ min: '', max: '' });
    expect(withLootCount(tree, '1', '3')).toEqual([
      { key: 'keep', value: '1' },
      { key: 'reward_loot_count', value: '1,3' },
    ]);
    const counted = { passthrough: withLootCount(tree, '2', '') };
    expect(lootCountOf(counted)).toEqual({ min: '2', max: '' });
    expect(withLootCount(counted, '', '')).toEqual([{ key: 'keep', value: '1' }]);
    expect(groundLootCountOf({ passthrough: withGroundLootCount({}, '1', '2') })).toEqual({ min: '1', max: '2' });
  });
});
