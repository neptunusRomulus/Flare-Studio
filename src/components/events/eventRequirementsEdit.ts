import type { EventData, EventItemRequirement } from '@/components/events/eventDialogModel';

type Requirements = EventData['requirements'];

/** A new empty item requirement with a unique id. */
export function newItemRequirement(id: string): EventItemRequirement {
  return { id, type: 'requires_item', itemId: '', itemQuantity: 1 };
}

export function withStatusAdded(reqs: Requirements): Requirements {
  return { ...reqs, status: [...reqs.status, ''] };
}

export function withStatusUpdated(reqs: Requirements, index: number, value: string): Requirements {
  return { ...reqs, status: reqs.status.map((s, i) => (i === index ? value : s)) };
}

export function withStatusRemoved(reqs: Requirements, index: number): Requirements {
  return { ...reqs, status: reqs.status.filter((_, i) => i !== index) };
}

export function withItemRequirementAdded(reqs: Requirements, id: string): Requirements {
  return { ...reqs, itemRequirements: [...reqs.itemRequirements, newItemRequirement(id)] };
}

export function withItemRequirementUpdated(
  reqs: Requirements,
  id: string,
  updates: Partial<Omit<EventItemRequirement, 'id'>>,
): Requirements {
  return {
    ...reqs,
    itemRequirements: reqs.itemRequirements.map((req) => (req.id === id ? { ...req, ...updates } : req)),
  };
}

export function withItemRequirementRemoved(reqs: Requirements, id: string): Requirements {
  return { ...reqs, itemRequirements: reqs.itemRequirements.filter((req) => req.id !== id) };
}
