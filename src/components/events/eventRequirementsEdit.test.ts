import { describe, expect, it } from 'vitest';
import {
  newItemRequirement,
  withItemRequirementAdded,
  withItemRequirementRemoved,
  withItemRequirementUpdated,
  withStatusAdded,
  withStatusRemoved,
  withStatusUpdated,
} from '@/components/events/eventRequirementsEdit';
import type { EventData, EventItemRequirement } from '@/components/events/eventDialogModel';

const base: EventData['requirements'] = {
  status: ['has_sword'],
  minLevel: 1,
  itemRequirements: [{ id: 'a', type: 'requires_item', itemId: 'apple', itemQuantity: 2 }],
  currency: 0,
};

describe('requirement edits', () => {
  it('appends a blank status and keeps the others', () => {
    expect(withStatusAdded(base).status).toEqual(['has_sword', '']);
  });

  it('edits one status by position without touching the rest', () => {
    const reqs = withStatusUpdated(base, 0, 'has_shield');
    expect(reqs.status).toEqual(['has_shield']);
    expect(reqs.itemRequirements).toBe(base.itemRequirements);
  });

  it('drops one status by position', () => {
    expect(withStatusRemoved({ ...base, status: ['a', 'b', 'c'] }, 1).status).toEqual(['a', 'c']);
  });

  it('adds an item requirement with the given id', () => {
    const reqs = withItemRequirementAdded(base, 'b');
    expect(reqs.itemRequirements.map((r) => r.id)).toEqual(['a', 'b']);
    expect(reqs.itemRequirements[1]).toEqual({ id: 'b', type: 'requires_item', itemId: '', itemQuantity: 1 });
  });

  it('patches only the matching requirement', () => {
    const reqs = withItemRequirementUpdated(base, 'a', { itemQuantity: 5 } as Partial<Omit<EventItemRequirement, 'id'>>);
    expect(reqs.itemRequirements[0]).toMatchObject({ id: 'a', itemId: 'apple', itemQuantity: 5 });
    expect(base.itemRequirements[0].itemQuantity).toBe(2);
  });

  it('removes by id and leaves unknown ids alone', () => {
    expect(withItemRequirementRemoved(base, 'a').itemRequirements).toEqual([]);
    expect(withItemRequirementRemoved(base, 'zz').itemRequirements).toHaveLength(1);
  });

  it('builds a fresh requirement whose id is not shared', () => {
    expect(newItemRequirement('x')).not.toBe(newItemRequirement('x'));
  });
});
