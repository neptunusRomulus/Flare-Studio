import React from 'react';
import SidebarEventEntries from '@/components/SidebarEventEntries';
import type { Event } from '@/EditorCore';

type Props = {
  isEventLayer: boolean;
  eventEntries: Event[];
  leftCollapsed: boolean;
  draggingEventId: string | null;
  handleEditEvent: (id: string) => void;
  setEventHoverTooltip: (p: { x: number; y: number } | null) => void;
  handleEventDragStart: (e: React.DragEvent, eventId: string) => void;
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
