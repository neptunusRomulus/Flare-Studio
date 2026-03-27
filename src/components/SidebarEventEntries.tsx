import type { DragEvent } from 'react';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import { GripVertical, Plus } from 'lucide-react';
import type { Event } from '@/EditorCore';

type EventEntriesPanelProps = {
  isEventLayer: boolean;
  eventEntries: Event[];
  leftCollapsed: boolean;
  draggingEventId: string | null;
  onEditEvent: (eventId: string) => void;
  onHover: (position: { x: number; y: number }) => void;
  onHoverEnd: () => void;
  onDragStart: (event: DragEvent<HTMLDivElement>, eventId: string) => void;
  onDragEnd: () => void;
  onAddEvent: () => void;
};

const SidebarEventEntries = ({
  isEventLayer,
  eventEntries,
  leftCollapsed,
  draggingEventId,
  onEditEvent,
  onHover,
  onHoverEnd,
  onDragStart,
  onDragEnd,
  onAddEvent
}: EventEntriesPanelProps) => {
  const [clickTimers, setClickTimers] = useState<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const handleEventClick = (eventId: string) => {
    const timer = setTimeout(() => {
      // Single click behavior can be added here if needed
      setClickTimers(prev => {
        const newMap = new Map(prev);
        newMap.delete(eventId);
        return newMap;
      });
    }, 300);

    setClickTimers(prev => new Map(prev).set(eventId, timer));
  };

  const handleEventDoubleClick = (eventId: string) => {
    // Clear the single click timer
    const timer = clickTimers.get(eventId);
    if (timer) clearTimeout(timer);

    // Open dialog for editing
    onEditEvent(eventId);
  };

  return (
    <>
      {isEventLayer && (
        <div className="flex-1 min-h-0 flex flex-col gap-3">
          {eventEntries.length === 0 ? (
            <div className="h-full border border-dashed border-border rounded-md flex items-center justify-center text-sm text-muted-foreground px-4 text-center">
              No events added yet. Use the Add control to create your first event.
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto pr-1">
              {eventEntries.map((event) => {
                const isPlacedOnMap = event.x >= 0 && event.y >= 0;

                return (
                  <div
                    key={event.id}
                    className={`rounded-md px-2 py-2 hover:bg-background transition-colors cursor-pointer ${
                      isPlacedOnMap
                        ? 'border-2 border-blue-500 bg-background/50'
                        : 'border border-dashed border-gray-400 dark:border-gray-600 bg-muted/20'
                    } ${draggingEventId === event.id ? 'opacity-50' : ''}`}
                    onClick={() => handleEventClick(event.id)}
                    onDoubleClick={() => handleEventDoubleClick(event.id)}
                    onMouseMove={(eventElem) => onHover({ x: eventElem.clientX, y: eventElem.clientY })}
                    onMouseLeave={onHoverEnd}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`flex-shrink-0 w-10 h-10 rounded border bg-muted/50 flex items-center justify-center overflow-hidden ${
                        isPlacedOnMap ? 'border-border' : 'border-dashed border-muted-foreground/40'
                      }`}
                      >
                        <div className="text-xs font-semibold text-muted-foreground">
                          {event.type.charAt(0).toUpperCase()}
                        </div>
                      </div>
                      <div className="space-y-1 text-sm flex-1 min-w-0">
                        <div className={`font-medium ${isPlacedOnMap ? 'text-foreground' : 'text-muted-foreground'}`} title={`Event[${event.id}] - ${event.type} @ (${event.x}, ${event.y})`}>
                          <span className={leftCollapsed ? 'sr-only' : ''}>
                            Event[{event.id}] - {event.type} @ ({event.x}, {event.y})
                          </span>
                          {!leftCollapsed || <span className="text-xs text-muted-foreground">[{event.id}]</span>}
                        </div>
                      </div>
                      <Tooltip content="Drag and drop to place event on map">
                        <div
                          draggable
                          onDragStart={(dragEvent) => onDragStart(dragEvent, event.id)}
                          onDragEnd={onDragEnd}
                          className="w-8 h-8 flex items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                          onClick={(clickEvent) => clickEvent.stopPropagation()}
                        >
                          <GripVertical className="w-5 h-5" />
                        </div>
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {isEventLayer && (
        <div className="flex justify-center py-2">
          <Tooltip content="Add Event" side="bottom">
            <Button
              variant="default"
              size="sm"
              aria-label="Add Event"
              className="text-xs px-3 py-1 h-7 shadow-sm bg-orange-500 hover:bg-orange-600 text-white border-orange-500"
              onClick={(event) => {
                event.stopPropagation();
                event.preventDefault();
                console.log('[UI] Add Event button clicked');
                onAddEvent();
              }}
            >
              <Plus className="w-3 h-3 mr-1" />
              Event
            </Button>
          </Tooltip>
        </div>
      )}
    </>
  );
};

export default SidebarEventEntries;
