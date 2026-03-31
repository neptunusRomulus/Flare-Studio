import React from 'react';
import SidebarEventEntries from '@/components/SidebarEventEntries';
import type { MapObject } from '@/types';

type Props = {
  isEventLayer: boolean;
  eventEntries: MapObject[];
  leftCollapsed: boolean;
  draggingEventId: number | null;
  handleEditEvent: (id: number) => void;
  handleDuplicateEvent: (id: number) => void;
  handleDeleteEvent: (id: number) => void;
  setEventHoverTooltip: (p: { x: number; y: number } | null) => void;
  handleEventDragStart: (e: React.DragEvent, eventId: number) => void;
  handleEventDragEnd: () => void;
  handleReorderEvents: (fromIndex: number, toIndex: number) => void;
  handleOpenEventDialog: () => void;
};

const SidebarEventArea: React.FC<Props> = ({
  isEventLayer,
  eventEntries,
  leftCollapsed,
  draggingEventId,
  handleEditEvent,
  handleDuplicateEvent,
  handleDeleteEvent,
  setEventHoverTooltip,
  handleEventDragStart,
  handleEventDragEnd,
  handleReorderEvents,
  handleOpenEventDialog
}) => {
  return (
    <SidebarEventEntries
      isEventLayer={isEventLayer}
      eventEntries={eventEntries}
      leftCollapsed={leftCollapsed}
      draggingEventId={draggingEventId}
      onEditEvent={handleEditEvent}
      onDuplicateEvent={handleDuplicateEvent}
      onDeleteEvent={handleDeleteEvent}
      onHover={() => {}}
      onHoverEnd={() => {}}
      onDragStart={handleEventDragStart}
      onDragEnd={handleEventDragEnd}
      onReorderEvents={handleReorderEvents}
      onAddEvent={handleOpenEventDialog}
    />
  );
};

export default SidebarEventArea;


