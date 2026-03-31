import React from 'react';
import SidebarActorEntries from '@/components/SidebarActorEntries';
import type { MapObject } from '@/types';

type Props = {
  isNpcLayer: boolean;
  isEnemyLayer: boolean;
  actorEntries: MapObject[];
  leftCollapsed: boolean;
  draggingNpcId: number | null;
  handleEditObject: (id: number) => void;
  handleDuplicateObject: (id: number) => void;
  handleDeleteObject: (id: number) => void;
  setNpcHoverTooltip: (p: { x: number; y: number } | null) => void;
  handleNpcDragStart: (e: React.DragEvent, actorId: number) => void;
  handleNpcDragEnd: () => void;
  handleReorderActors: (fromIndex: number, toIndex: number) => void;
  handleOpenActorDialog: (type: 'npc' | 'enemy') => void;
};

const SidebarActorArea: React.FC<Props> = ({
  isNpcLayer,
  isEnemyLayer,
  actorEntries,
  leftCollapsed,
  draggingNpcId,
  handleEditObject,
  handleDuplicateObject,
  handleDeleteObject,
  setNpcHoverTooltip,
  handleNpcDragStart,
  handleNpcDragEnd,
  handleReorderActors,
  handleOpenActorDialog
}) => {
  return (
    <SidebarActorEntries
      isNpcLayer={isNpcLayer}
      isEnemyLayer={isEnemyLayer}
      actorEntries={actorEntries}
      leftCollapsed={leftCollapsed}
      draggingNpcId={draggingNpcId}
      onEditObject={handleEditObject}
      onDuplicateObject={handleDuplicateObject}
      onDeleteObject={handleDeleteObject}
      onHover={(pos) => setNpcHoverTooltip(pos)}
      onHoverEnd={() => setNpcHoverTooltip(null)}
      onDragStart={handleNpcDragStart}
      onDragEnd={handleNpcDragEnd}
      onReorderActors={handleReorderActors}
      onAddNpc={() => handleOpenActorDialog('npc')}
      onAddEnemy={() => handleOpenActorDialog('enemy')}
    />
  );
};

export default SidebarActorArea;
