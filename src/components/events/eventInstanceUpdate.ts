import { ACTIVATION_TO_FLARE, type EventData } from '@/components/events/eventDialogModel';
import { buildEventInstanceProps } from '@/components/events/eventInstanceProps';
import { instancePropertiesFrom } from '@/editor/eventScripts';
import type { EventExtraRow } from '@/editor/eventExtraProperties';

export type EventInstanceUpdate = {
  name: string;
  description: string;
  type: 'event';
  activate: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties: Record<string, string | string[]>;
};

/**
 * The map object an event save writes: the form plus the extra rows decide the keys, and a resolved
 * script path overrides whatever the form held. Nothing is carried over from the previous object —
 * its leftover action keys are moved into a script before this runs (see `actionPropertiesFrom`).
 */
export function buildEventInstanceUpdate(args: {
  eventData: EventData;
  extraRows: EventExtraRow[];
  script?: string;
}): EventInstanceUpdate {
  const { coordinates, size } = args.eventData.positioning;
  const properties = instancePropertiesFrom(buildEventInstanceProps(args.eventData, args.extraRows));
  if (args.script) properties.script = args.script;
  return {
    name: args.eventData.name || 'Event',
    description: args.eventData.description || '',
    type: 'event',
    activate: ACTIVATION_TO_FLARE[args.eventData.timing.activeActivation || ''] || 'on_trigger',
    x: coordinates.x,
    y: coordinates.y,
    width: size.width,
    height: size.height,
    properties,
  };
}
