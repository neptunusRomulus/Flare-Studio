import React from 'react';
import SidebarEventEntries from '@/components/SidebarEventEntries';
import type { MapObject } from '@/types';

type Props = {
  isEventLayer: boolean;
  eventEntries: MapObject[];
  leftCollapsed: boolean;
  draggingEventId: number | null;
  handleEditEvent: (id: number) => void;
  setEventHoverTooltip: (p: { x: number; y: number } | null) => void;
  handleEventDragStart: (e: React.DragEvent, eventId: number) => void;
  handleEventDragEnd: () => void;
  handleOpenEventDialog: () => void;
};

const SidebarEventArea: React.FC<Props> = ({
  isEventLayer,
  eventEntries,
  leftCollapsed,
  draggingEventId,
  handleEditEvent,
  setEventHoverTooltip,
  handleEventDragStart,
  handleEventDragEnd,
  handleOpenEventDialog
}) => {
  return (
    <SidebarEventEntries
      isEventLayer={isEventLayer}
      eventEntries={eventEntries}
      leftCollapsed={leftCollapsed}
      draggingEventId={draggingEventId}
      onEditEvent={handleEditEvent}
      onHover={(pos) => setEventHoverTooltip(pos)}
      onHoverEnd={() => setEventHoverTooltip(null)}
      onDragStart={handleEventDragStart}
      onDragEnd={handleEventDragEnd}
      onAddEvent={handleOpenEventDialog}
    />
  );
};

export default SidebarEventArea;


