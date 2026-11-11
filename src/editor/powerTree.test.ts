import { describe, expect, it } from 'vitest';
import { parsePowerTree, serializePowerTree } from './powerTree';

const sample = `# tab 0
[tab]
title=Warrior

[power]
id=1
tab=0
position=96,136
requires_primary=physical,1

[power]
id=7
tab=0
position=224,264
requires_power=1
upgrades=8

[upgrade]
id=8
requires_power=7
requires_point=true
`;

describe('powerTree', () => {
  it('reads tabs, positions and requires_power, and keeps extra keys on write', () => {
    const tree = parsePowerTree(sample);
    expect(tree.tabs.map((t) => t.title)).toEqual(['Warrior']);
    expect(tree.nodes[0]).toMatchObject({ kind: 'power', id: '1', tab: '0', position: '96,136' });
    expect(tree.nodes[1].requires_power).toBe('1');
    expect(tree.nodes[2]).toMatchObject({ kind: 'upgrade', id: '8', requires_power: '7' });
    const text = serializePowerTree(tree);
    expect(text).toContain('[tab]\ntitle=Warrior');
    expect(text).toContain('position=224,264');
    expect(text).toContain('requires_power=1');
    expect(text).toContain('requires_primary=physical,1');
    expect(text).toContain('upgrades=8');
    expect(text).toContain('[upgrade]\nid=8');
  });
});
