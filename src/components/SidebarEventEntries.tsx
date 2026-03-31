import type { DragEvent } from 'react';
import React from 'react';
import { Button } from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import { GripVertical, HelpCircle, Plus, MousePointerClick, MapPinPlus, MapPinMinus, LogIn, LogOut, SquareCheckBig, Repeat2 } from 'lucide-react';
import type { MapObject } from '@/types';
import ElementContextMenu from '@/components/ElementContextMenu';
import ListItemTooltip from '@/components/ListItemTooltip';
import { ACTIVATION_COLORS } from '@/editor/eventActivationColors';
import useListReorder from '@/hooks/useListReorder';

const ACTIVATION_ICON: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  Interact: MousePointerClick,
  Trigger: MapPinPlus,
  Leave: MapPinMinus,
  Load: LogIn,
  MapExit: LogOut,
  MapClear: SquareCheckBig,
  Loop: Repeat2,
};

const FLARE_TO_ACTIVATION: Record<string, string> = {
  on_interact: 'Interact',
  on_trigger: 'Trigger',
  on_leave: 'Leave',
  on_load: 'Load',
  on_mapexit: 'MapExit',
  on_clear: 'MapClear',
  static: 'Loop',
};

type EventEntriesPanelProps = {
  isEventLayer: boolean;
  eventEntries: MapObject[];
  leftCollapsed: boolean;
  draggingEventId: number | null;
  onEditEvent: (eventId: number) => void;
  onDuplicateEvent: (eventId: number) => void;
  onDeleteEvent: (eventId: number) => void;
  onHover: (position: { x: number; y: number }) => void;
  onHoverEnd: () => void;
  onDragStart: (event: DragEvent<HTMLDivElement>, eventId: number) => void;
  onDragEnd: () => void;
  onReorderEvents: (fromIndex: number, toIndex: number) => void;
  onAddEvent: () => void;
};

const SidebarEventEntries = ({
  isEventLayer,
  eventEntries,
  leftCollapsed,
  draggingEventId,
  onEditEvent,
  onDuplicateEvent,
  onDeleteEvent,
  onHover,
  onHoverEnd,
  onDragStart,
  onDragEnd,
  onReorderEvents,
  onAddEvent
}: EventEntriesPanelProps) => {
  const { getItemDragProps, reorderClass } = useListReorder(
    eventEntries,
    (e) => e.id,
    onReorderEvents,
  );

  return (
  <>
    {isEventLayer && (
      <div className="flex-1 min-h-0 flex flex-col gap-3">
        {eventEntries.length === 0 ? (
          <div className="h-full border border-dashed border-border rounded-md flex items-center justify-center text-sm text-muted-foreground px-4 text-center">
            No events added yet. Use the Add control to create your first event.
          </div>
        ) : (
          <div className="flex flex-col gap-2 overflow-y-auto pr-1">
            {eventEntries.map((event, index) => {
              const isPlacedOnMap = event.x >= 0 && event.y >= 0;
              const activationLabel = event.activate ? FLARE_TO_ACTIVATION[event.activate] || event.activate : null;

              return (
                <ListItemTooltip key={event.id}>
                <ElementContextMenu
                  elementType="event"
                  onEdit={() => onEditEvent(event.id)}
                  onDuplicate={() => onDuplicateEvent(event.id)}
                  onDelete={() => onDeleteEvent(event.id)}
                >
                <div
                  {...getItemDragProps(index)}
                  className={`w-full box-border rounded-md px-2 py-2 hover:bg-background transition-colors cursor-pointer border border-dashed border-gray-400 dark:border-gray-600 flex ${
                    isPlacedOnMap ? 'bg-background/50' : 'bg-muted/20'
                  } ${draggingEventId === event.id ? 'opacity-50' : ''} ${reorderClass(index)}`}
                  onClick={() => onEditEvent(event.id)}
                  onMouseMove={(eventElem) => onHover({ x: eventElem.clientX, y: eventElem.clientY })}
                  onMouseLeave={onHoverEnd}
                >
                  <div className="flex items-center gap-2 w-full">
                    <div className={`flex-shrink-0 w-10 h-10 rounded border bg-muted/50 flex items-center justify-center overflow-hidden ${
                      isPlacedOnMap ? 'border-border' : 'border-dashed border-muted-foreground/40'
                    }`}
                    >
                      {(() => {
                        const IconComp = activationLabel ? ACTIVATION_ICON[activationLabel] : null;
                        return IconComp
                          ? <IconComp className={`w-5 h-5 ${ACTIVATION_COLORS[activationLabel!]?.icon ?? 'text-muted-foreground'}`} />
                          : <HelpCircle className="w-5 h-5 text-muted-foreground" />;
                      })()}
                    </div>
                    <div className="space-y-1 text-sm flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">
                        <span className={leftCollapsed ? 'sr-only' : ''}>{event.name || `Event #${event.id}`}</span>
                        {!event.name && leftCollapsed && <span className="text-xs text-muted-foreground">#{event.id}</span>}
                      </div>
                      {!leftCollapsed && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {activationLabel ? (
                            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium border ${ACTIVATION_COLORS[activationLabel]?.badge ?? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30'}`}>
                              {activationLabel}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-gray-500/20 text-gray-600 dark:text-gray-400 border border-gray-500/30">
                              Unassigned
                            </span>
                          )}
                        </div>
                      )}
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
                </ElementContextMenu>
                </ListItemTooltip>
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
