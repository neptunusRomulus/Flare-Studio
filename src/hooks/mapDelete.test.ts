import { describe, it, expect } from 'vitest';
import { isProjectEmptyAfterDelete, remainingMapsAfterDelete } from './mapDelete';

describe('map delete', () => {
  it('last map -> empty project', () => {
    expect(isProjectEmptyAfterDelete([], 'Town')).toBe(true);
    expect(isProjectEmptyAfterDelete(['Town.json'], 'Town')).toBe(true); // listing raced the delete
    expect(isProjectEmptyAfterDelete(['My Town.json'], 'My Town')).toBe(true);
  });
  it('other maps remain -> normal flow', () => {
    expect(remainingMapsAfterDelete(['Town.json', 'Cave.json'], 'Town')).toEqual(['Cave.json']);
    expect(isProjectEmptyAfterDelete(['Cave.json'], 'Town')).toBe(false);
  });
});
