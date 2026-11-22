import { ACTIVATION_TO_FLARE, type EventData } from '@/components/events/eventDialogModel';
import { buildEventInstanceProps } from '@/components/events/eventInstanceProps';
import { instancePropertiesFrom } from '@/editor/eventScripts';
import { mergeEventFormProperties, type EventPropertyValue } from '@/editor/eventFormProperties';
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
 * The map object an event save writes: form values win, keys the form does not model survive, and a
 * resolved script path overrides whatever the form held.
 */
export function buildEventInstanceUpdate(args: {
  eventData: EventData;
  extraRows: EventExtraRow[];
  existingProperties?: Record<string, EventPropertyValue | undefined> | null;
  script?: string;
}): EventInstanceUpdate {
  const { coordinates, size } = args.eventData.positioning;
  const props = instancePropertiesFrom(buildEventInstanceProps(args.eventData, args.extraRows));
  if (args.script) props.script = args.script;
  const properties = instancePropertiesFrom(mergeEventFormProperties(args.existingProperties, props));
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
