import { readFileSync, existsSync } from 'fs';
import { describe, expect, it } from 'vitest';
import {
  parsePowerTree,
  serializePowerTree,
  setPowerUpgrades,
  updateNode,
  updateTab,
  listTreePaths,
  powersOnTab,
  parsePosition,
} from './powerTree';

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

const EMPYREAN = '/home/ism/Projects/Flare/flare-game/mods/empyrean_campaign/powers/trees/default.txt';

describe('powerTree', () => {
  it('reads tabs, positions and requires_power, and keeps extra keys on write', () => {
    const tree = parsePowerTree(sample);
    expect(tree.items.filter((i) => i.kind === 'tab').map((t) => t.kind === 'tab' && t.title)).toEqual(['Warrior']);
    const first = tree.items.find((i) => i.kind === 'power' && i.id === '1');
    expect(first).toMatchObject({ kind: 'power', id: '1', tab: '0', position: '96,136' });
    const seven = tree.items.find((i) => i.kind === 'power' && i.id === '7');
    expect(seven && seven.kind === 'power' && seven.requires_power).toEqual(['1']);
    const upgrade = tree.items.find((i) => i.kind === 'upgrade');
    expect(upgrade).toMatchObject({ kind: 'upgrade', id: '8', requires_power: ['7'] });
    const text = serializePowerTree(tree);
    expect(text).toContain('[tab]\ntitle=Warrior');
    expect(text).toContain('position=224,264');
    expect(text).toContain('requires_power=1');
    expect(text).toContain('requires_primary=physical,1');
    expect(text).toContain('upgrades=8');
    expect(text).toContain('[upgrade]\nid=8');
  });

  it('round-trips an unedited tree including comments, background, deprecated and unknown keys', () => {
    const fixture = `# file comment
background=images/menus/powers.png
# also keep this

# tab 0
[tab]
title=Warrior
background=images/menus/warrior.png

### Warrior
# swing
[power]
id=1
tab=0
position=96,136
requires_primary=physical,1
visible_requires_status=old_flag
mystery_key=keep-me

[power]
id=7
tab=0
position=224,264
requires_point=true
upgrades=8

[upgrade]
id=8
requires_point=true
requires_power=7

# same power on another tab
[power]
id=1
tab=1
position=10,20
visible_check_locked=true
`;
    const tree = parsePowerTree(fixture);
    expect(tree.background).toBe('images/menus/powers.png');
    expect(powersOnTab(tree, 0).map((n) => n.id)).toEqual(['1', '7']);
    expect(powersOnTab(tree, 1).map((n) => n.id)).toEqual(['1']);
    const first = powersOnTab(tree, 0)[0];
    expect(first.entries.some((e) => e.key === 'visible_requires_status' && e.value === 'old_flag')).toBe(true);
    expect(first.entries.some((e) => e.key === 'mystery_key' && e.value === 'keep-me')).toBe(true);
    expect(serializePowerTree(tree)).toBe(fixture);
  });

  it('keeps comments and keys after a full rebuild, and can change background', () => {
    const fixture = `# heading
background=old.png

# tab
[tab]
title=A

# node
[power]
id=3
tab=0
position=1,2
# inner note is a comment in the next section, not here
`;
    const tree = parsePowerTree(fixture);
    tree.background = 'new.png';
    const text = serializePowerTree({ ...tree }, { rebuildAll: true });
    expect(text).toContain('# heading');
    expect(text).toContain('background=new.png');
    expect(text).not.toContain('background=old.png');
    expect(text).toContain('# tab');
    expect(text).toContain('# node');
    expect(text).toContain('id=3');
  });

  it('updates requirements and syncs [upgrade] blocks with upgrades=', () => {
    const tree = parsePowerTree(sample);
    const powerIndex = tree.items.findIndex((i) => i.kind === 'power' && i.id === '7');
    const withLevel = replaceAndUpdate(tree, powerIndex, { requires_level: '4', requires_point: true });
    const synced = setPowerUpgrades(withLevel, powerIndex, ['8', '9']);
    const text = serializePowerTree(synced, { rebuildAll: true });
    expect(text).toContain('requires_level=4');
    expect(text).toContain('requires_point=true');
    expect(text).toContain('upgrades=8,9');
    expect(text).toMatch(/\[upgrade\]\nid=8/);
    expect(text).toMatch(/\[upgrade\]\nid=9/);
    const dropped = setPowerUpgrades(synced, powerIndex, ['9']);
    const droppedText = serializePowerTree(dropped, { rebuildAll: true });
    expect(droppedText).toContain('upgrades=9');
    expect(droppedText).not.toContain('id=8');
  });

  it('lists tree file paths and parses positions', () => {
    expect(listTreePaths({ 'powers/trees/default.txt': '', 'powers/powers.txt': '', 'powers/trees/mage.txt': '' })).toEqual([
      'powers/trees/default.txt',
      'powers/trees/mage.txt',
    ]);
    expect(parsePosition('96,136')).toEqual({ x: 96, y: 136 });
  });

  it('round-trips the Empyrean default tree when the official file is present', () => {
    if (!existsSync(EMPYREAN)) return;
    const original = readFileSync(EMPYREAN, 'utf8');
    const tree = parsePowerTree(original);
    expect(tree.items.filter((i) => i.kind === 'tab')).toHaveLength(3);
    expect(tree.items.filter((i) => i.kind === 'power')).toHaveLength(39);
    expect(tree.items.filter((i) => i.kind === 'upgrade')).toHaveLength(132);
    expect(serializePowerTree(tree)).toBe(original);
    const rebuilt = serializePowerTree(tree, { rebuildAll: true });
    const comments = (text: string) => text.split('\n').filter((line) => line.trim().startsWith('#')).map((line) => line.trim());
    expect(comments(rebuilt)).toEqual(comments(original));
    const keys = (text: string) => text.split('\n').map((line) => line.trim()).filter((line) => line.includes('=') || /^\[[^\]]+\]$/.test(line));
    expect(keys(rebuilt)).toEqual(keys(original));
  });
});

function replaceAndUpdate(
  tree: ReturnType<typeof parsePowerTree>,
  index: number,
  patch: Parameters<typeof updateNode>[1],
) {
  const item = tree.items[index];
  if (item.kind !== 'power' && item.kind !== 'upgrade') return tree;
  return {
    ...tree,
    items: tree.items.map((current, i) => {
      if (i !== index) return current;
      if (current.kind !== 'power' && current.kind !== 'upgrade') return current;
      return updateNode(current, patch);
    }),
  };
}
