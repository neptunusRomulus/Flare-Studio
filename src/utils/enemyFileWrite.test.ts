import { describe, expect, it } from 'vitest';
import type { MapObject } from '@/types';
import { enemyFileTextFromObject, enemyRelPath } from './enemyFileWrite';

const enemy = (properties: Record<string, string>, extra: Partial<MapObject> = {}): MapObject => ({
  id: 3,
  name: 'TESTEnemy',
  type: 'enemy',
  x: 4,
  y: 4,
  width: 1,
  height: 1,
  properties,
  ...extra,
});

describe('enemyFileTextFromObject', () => {
  it('writes loot and name into a new enemies/*.txt', () => {
    const { text } = enemyFileTextFromObject(enemy({ loot: '1,fixed' }));
    expect(text).toContain('name=TESTEnemy');
    expect(text).toContain('loot=1,fixed');
  });

  it('updates loot in an existing file without dropping INCLUDE', () => {
    const existing = 'INCLUDE enemies/base/goblin.txt\nname=Old\nloot=2,50\n';
    const { text } = enemyFileTextFromObject(enemy({ loot: '1,fixed', include: 'enemies/base/goblin.txt' }), existing);
    expect(text).toContain('INCLUDE enemies/base/goblin.txt');
    expect(text).toContain('loot=1,fixed');
    expect(text).not.toContain('loot=2,50');
  });

  it('keeps map spawn conditions out of the enemy file', () => {
    const { text } = enemyFileTextFromObject(enemy({
      loot: '1,fixed',
      requires_status: 'quest_started',
      requires_level: '5',
      invincible_requires_status: 'boss_phase',
      spawn_level: 'fixed,3',
    }));
    expect(text).toContain('loot=1,fixed');
    expect(text).not.toContain('requires_status=');
    expect(text).not.toContain('requires_level=');
    expect(text).not.toContain('invincible_requires_status=');
    expect(text).not.toContain('spawn_level=');
  });

  it('keeps a subfolder in the relative path', () => {
    expect(enemyRelPath(enemy({ enemyFilename: 'enemies/base/antlion.txt' }))).toBe('enemies/base/antlion.txt');
    expect(enemyRelPath(enemy({ sourcePath: 'enemies/testenemy.txt' }))).toBe('enemies/testenemy.txt');
  });
});
