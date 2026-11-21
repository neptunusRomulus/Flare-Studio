import type { DragEvent } from 'react';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Tooltip from '@/components/ui/tooltip';
import { FieldHint } from '@/components/ui/field-hint';
import { entityPlacement } from '@/components/entityPlacement';
import { GripVertical } from 'lucide-react';
import ListAddButton from '@/components/ListAddButton';
import ElementContextMenu from '@/components/ElementContextMenu';
import ListItemTooltip from '@/components/ListItemTooltip';
import type { EventScriptEntry } from '@/editor/eventScripts';

type EventEntriesPanelProps = {
  isEventLayer: boolean;
  eventEntries: EventScriptEntry[];
  draggingEventId: string | null;
  onEditEvent: (scriptPath: string) => void;
  onDuplicateEvent: (scriptPath: string) => void;
  onDeleteEvent: (scriptPath: string) => void;
  onHover: (position: { x: number; y: number }) => void;
  onHoverEnd: () => void;
  onDragStart: (event: DragEvent<HTMLDivElement>, scriptPath: string) => void;
  onDragEnd: () => void;
  onAddEvent: (name?: string) => void;
};

const SidebarEventEntries = ({
  isEventLayer,
  eventEntries,
  draggingEventId,
  onEditEvent,
  onDuplicateEvent,
  onDeleteEvent,
  onHover,
  onHoverEnd,
  onDragStart,
  onDragEnd,
  onAddEvent
}: EventEntriesPanelProps) => {
  const armed = React.useSyncExternalStore(entityPlacement.subscribe, entityPlacement.get, entityPlacement.get);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');

  const submitCreate = () => {
    onAddEvent(title.trim() || undefined);
    setCreating(false);
    setTitle('');
  };

  return (
  <>
      {isEventLayer && (
        <div className="flex items-center justify-between gap-2 px-1 py-1.5">
          <FieldHint hint="An event is a scripts/*.txt file: what happens. Drag it onto the map, or click the handle and drag an area, to place an instance. Where and when are set on that instance. The same event can also be called from a book, NPC dialogue, or power with script=.">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Events</div>
          </FieldHint>
          <ListAddButton label="Add Event" onClick={() => setCreating(true)} />
        </div>
      )}
    {isEventLayer && creating && (
      <div className="flex flex-wrap items-center gap-1 px-1">
        <Input width="name" className="h-7 text-xs" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') submitCreate(); if (e.key === 'Escape') { setCreating(false); setTitle(''); } }} />
        <Button type="button" size="sm" className="h-7 text-xs" onClick={submitCreate}>Create</Button>
      </div>
    )}
    {isEventLayer && (
      <div className="flex-1 min-h-0 flex flex-col gap-3">
        {eventEntries.length === 0 ? (
          <div className="h-full border border-dashed border-border rounded-md flex items-center justify-center text-sm text-muted-foreground px-4 text-center">
            No events yet. Add one, then drag it onto the map or link it with script=.
          </div>
        ) : (
          <div className="flex flex-col gap-2 overflow-y-auto pr-1">
            {eventEntries.map((event) => {
              const armedHere = armed?.type === 'event' && armed.script === event.path;
              return (
                <ListItemTooltip key={event.path} item={{ id: event.path, name: event.name }}>
                <ElementContextMenu
                  elementType="event"
                  onEdit={() => onEditEvent(event.path)}
                  onDuplicate={() => onDuplicateEvent(event.path)}
                  onDelete={() => onDeleteEvent(event.path)}
                >
                <div
                  className={`w-full box-border rounded-md px-2 py-2 hover:bg-background transition-colors cursor-pointer border border-dashed border-gray-400 dark:border-gray-600 flex bg-background/50 ${
                    draggingEventId === event.path ? 'opacity-50' : ''
                  }`}
                  onClick={() => onEditEvent(event.path)}
                  onMouseMove={(eventElem) => onHover({ x: eventElem.clientX, y: eventElem.clientY })}
                  onMouseLeave={onHoverEnd}
                >
                  <div className="flex items-center gap-2 w-full">
                    <div className="space-y-1 text-sm flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">
                        <span>{event.name}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        used in {event.usage} {event.usage === 1 ? 'place' : 'places'}
                      </div>
                    </div>
                    <Tooltip content="Drag to the map, or click then drag an area on the map to place an instance">
                      <div
                        draggable
                        onDragStart={(dragEvent) => onDragStart(dragEvent, event.path)}
                        onDragEnd={onDragEnd}
                        className={`w-8 h-8 flex items-center justify-center cursor-grab active:cursor-grabbing transition-colors flex-shrink-0 rounded ${armedHere ? 'text-primary ring-1 ring-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        onClick={(clickEvent) => { clickEvent.stopPropagation(); entityPlacement.toggle({ type: 'event', script: event.path }); }}
                        data-armed={armedHere ? 'true' : undefined}
                      >
                        <GripVertical className="w-5 h-5" />
                      </div>
                    </Tooltip>
                  </div>
                </div>
                </ElementContextMenu>
                </ListItemTooltip>
              );
            })}
          </div>
        )}
      </div>
    )}
    </>
  );
};

export default SidebarEventEntries;
