import { describe, expect, it } from 'vitest';
import { parseItemRandomizer, serializeItemRandomizer } from './itemRandomizer';

const FIXTURE = `# mastite weapons

[option]
chance=100
quality=mastite
bonus_count=1,1
level_src=hero
level_range=0,0

# rare roll
[option]
chance=5
quality=mastite
bonus_count=1,2
level_src=hero
level_range=0,1

[bonuses]
# damage
bonus=accuracy,base:10:15,item_level:1:2
bonus_power_level=1,base:1:5:1
`;

describe('itemRandomizer', () => {
  it('parses options and bonuses, keeping comments', () => {
    const parsed = parseItemRandomizer(FIXTURE);
    expect(parsed.header).toContain('# mastite weapons');
    expect(parsed.options).toHaveLength(2);
    expect(parsed.options[0]).toMatchObject({
      chance: '100', quality: 'mastite', bonus_count: '1,1', level_src: 'hero', level_range: '0,0',
    });
    expect(parsed.options[1].comment).toContain('# rare roll');
    expect(parsed.bonuses).toEqual([
      { kind: 'bonus', value: 'accuracy,base:10:15,item_level:1:2', comment: '# damage' },
      { kind: 'bonus_power_level', value: '1,base:1:5:1', comment: '' },
    ]);
  });

  it('round-trips and omits empty keys', () => {
    const out = serializeItemRandomizer(parseItemRandomizer(FIXTURE));
    expect(out).toContain('bonus_power_level=1,base:1:5:1');
    expect(out).toContain('# rare roll');
    expect(serializeItemRandomizer(parseItemRandomizer(out)).trim()).toBe(out.trim());
  });
});
