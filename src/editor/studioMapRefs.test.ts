import { describe, expect, it } from 'vitest';
import { findProjectProblems } from './projectProblems';
import { findUsages } from './projectRefs';
import { mergeMapObjectRefs, objectDefinitionPath, textFromMapObject } from './studioMapRefs';

const itemsOnlyGroups = {
  'items/items.txt': `APPEND

[item]
# role=loot_groups
id=2
name=Vendor Constant Stock

[item]
# role=loot_groups
id=3
name=Vendor Random Stock
`,
};

const testEnemy = {
  id: 3,
  name: 'TESTEnemy',
  type: 'enemy' as const,
  properties: {
    loot: '1,fixed',
    sourcePath: 'enemies/testenemy.txt',
    enemyFilename: 'enemies/testenemy.txt',
  },
};

describe('studio map-JSON refs', () => {
  it('builds a definition path and property text from a map object', () => {
    expect(objectDefinitionPath(testEnemy)).toBe('enemies/testenemy.txt');
    expect(textFromMapObject(testEnemy)).toContain('loot=1,fixed');
  });

  it('reports an unknown loot item that lives only on a Studio map object, even when the only item ids are loot groups', () => {
    const files = mergeMapObjectRefs(itemsOnlyGroups, { 'npctest123.json': { objects: [testEnemy] } });
    expect(files['enemies/testenemy.txt']).toBeUndefined();
    expect(files['npctest123.json#enemy/3']).toContain('loot=1,fixed');
    const problems = findProjectProblems(files);
    const loot = problems.filter((p) => p.kind === 'loot');
    expect(loot).toHaveLength(1);
    expect(loot[0].message).toContain('Unknown item 1');
    expect(loot[0].path).toBe('npctest123.json#enemy/3');
    expect(findUsages(files, 'item', '1').some((u) => u.path === 'npctest123.json#enemy/3' && u.key === 'loot')).toBe(true);
  });

  it('does not double-report when the same loot line already exists in the enemy file', () => {
    const withFile = {
      ...itemsOnlyGroups,
      'enemies/testenemy.txt': 'name=TESTEnemy\nloot=1,fixed\n',
    };
    const files = mergeMapObjectRefs(withFile, { 'npctest123.json': { objects: [testEnemy] } });
    expect(files['npctest123.json#enemy/3']).toBeUndefined();
    const loot = findProjectProblems(files).filter((p) => p.kind === 'loot' && p.message.includes('Unknown item 1'));
    expect(loot).toHaveLength(1);
    expect(loot[0].path).toBe('enemies/testenemy.txt');
  });

  it('still reports a missing item when the project has no item sections at all', () => {
    const files = mergeMapObjectRefs(
      { 'maps/town.txt': 'loot=99,80,1,1\n' },
      {},
    );
    expect(findProjectProblems(files).some((p) => p.message.includes('Unknown item 99'))).toBe(true);
  });
});
