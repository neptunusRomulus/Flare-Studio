import type { MapObject } from '@/types';

export type LocatedObject = {
  x: number;
  y: number;
  width?: number;
  height?: number;
  properties?: MapObject['properties'];
};

/** Flare `location=x,y,w,h` derived from the live object position. */
export function mapLocationValue(object: LocatedObject): string {
  return `${object.x},${object.y},${object.width ?? 1},${object.height ?? 1}`;
}

export function propertiesWithSyncedLocation(object: LocatedObject): MapObject['properties'] {
  return {
    ...(object.properties || {}),
    location: mapLocationValue(object),
  };
}

/** Overlay used when writing a Flare [npc]/[enemy] block: live x,y always win. */
export function applyExportLocation(
  record: Record<string, unknown>,
  object: LocatedObject,
): Record<string, unknown> {
  record.location = mapLocationValue(object);
  return record;
}

/** Merge map-object updates so a move or resize also rewrites properties.location. */
export function updatesWithSyncedLocation(
  current: LocatedObject,
  updates: Partial<LocatedObject> & { properties?: MapObject['properties'] },
): Partial<LocatedObject> & { properties?: MapObject['properties'] } {
  if (
    updates.x === undefined &&
    updates.y === undefined &&
    updates.width === undefined &&
    updates.height === undefined
  ) {
    return updates;
  }
  const next: LocatedObject = {
    x: updates.x ?? current.x,
    y: updates.y ?? current.y,
    width: updates.width ?? current.width ?? 1,
    height: updates.height ?? current.height ?? 1,
    properties: {
      ...(current.properties || {}),
      ...(updates.properties || {}),
    },
  };
  return {
    ...updates,
    properties: propertiesWithSyncedLocation(next),
  };
}
