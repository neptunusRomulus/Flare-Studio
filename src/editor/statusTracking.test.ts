import { describe, expect, it } from 'vitest';
import { collectStatusHitsFromText, groupStatusHits } from './statusTracking';

const MAP = `# town
[event]
requires_status=quest_started,hero_ready
set_status=quest_started
unset_status=temp_flag
random_status=append,pool_a,pool_b
quest_loot=need_this,not_that,12
`;

describe('statusTracking', () => {
  it('classifies set, unset, require and special keys', () => {
    const rows = groupStatusHits(collectStatusHitsFromText('maps/town.txt', MAP));
    const by = Object.fromEntries(rows.map((row) => [row.status, row]));
    expect(by.quest_started.set[0]).toMatchObject({ file: 'maps/town.txt', line: 4, key: 'set_status' });
    expect(by.quest_started.require[0].key).toBe('requires_status');
    expect(by.hero_ready.require).toHaveLength(1);
    expect(by.temp_flag.unset).toHaveLength(1);
    expect(by.pool_a.other[0].key).toBe('random_status');
    expect(by.need_this.require[0].key).toBe('quest_loot');
    expect(by.not_that.require_not[0].key).toBe('quest_loot');
  });
});
