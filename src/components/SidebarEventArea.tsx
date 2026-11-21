import React from 'react';
import SidebarEventEntries from '@/components/SidebarEventEntries';
import type { EventScriptEntry } from '@/editor/eventScripts';

type Props = {
  isEventLayer: boolean;
  eventEntries: EventScriptEntry[];
  draggingEventId: string | null;
  handleEditEvent: (scriptPath: string) => void;
  handleDuplicateEvent: (scriptPath: string) => void;
  handleDeleteEvent: (scriptPath: string) => void;
  setEventHoverTooltip: (p: { x: number; y: number } | null) => void;
  handleEventDragStart: (e: React.DragEvent, scriptPath: string) => void;
  handleEventDragEnd: () => void;
  handleOpenEventDialog: (name?: string) => void;
};

const SidebarEventArea: React.FC<Props> = ({
  isEventLayer,
  eventEntries,
  draggingEventId,
  handleEditEvent,
  handleDuplicateEvent,
  handleDeleteEvent,
  setEventHoverTooltip,
  handleEventDragStart,
  handleEventDragEnd,
  handleOpenEventDialog
}) => {
  return (
    <SidebarEventEntries
      isEventLayer={isEventLayer}
      eventEntries={eventEntries}
      draggingEventId={draggingEventId}
      onEditEvent={handleEditEvent}
      onDuplicateEvent={handleDuplicateEvent}
      onDeleteEvent={handleDeleteEvent}
      onHover={() => {}}
      onHoverEnd={() => setEventHoverTooltip(null)}
      onDragStart={handleEventDragStart}
      onDragEnd={handleEventDragEnd}
      onAddEvent={handleOpenEventDialog}
    />
  );
};

export default SidebarEventArea;
