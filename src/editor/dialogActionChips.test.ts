import { describe, expect, it } from 'vitest';
import { actionChipLabel, actionChipTooltip, chipsFromActions, filterActionCatalog } from './dialogActionChips';

describe('dialog action chips', () => {
  it('labels rewards and effects in player terms and keeps the raw key in the tooltip', () => {
    const chips = chipsFromActions(
      [
        { id: '1', type: 'xp', value: '50' },
        { id: '2', type: 'item', value: '1000', quantity: 1 },
      ],
      [
        { id: '3', type: 'teleport', value: 'maps/harbor.txt' },
        { id: '4', type: 'set_status', value: 'emp_krolan_init' },
      ],
    );
    const name = (id: string) => (id === '1000' ? 'Sword' : id);
    expect(chips.map((chip) => actionChipLabel(chip, name))).toEqual([
      '+50 XP',
      'Gives Sword',
      'Teleports to maps/harbor.txt',
      'Sets emp krolan init',
    ]);
    expect(actionChipTooltip(chips[0])).toBe('reward_xp=50');
    expect(actionChipTooltip(chips[2])).toBe('teleport=maps/harbor.txt');
    expect(filterActionCatalog('teleport').map((entry) => entry.type)).toContain('teleport');
  });
});
