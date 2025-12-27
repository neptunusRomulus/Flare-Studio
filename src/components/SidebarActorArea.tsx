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
  setNpcHoverTooltip: (p: { x: number; y: number } | null) => void;
  handleNpcDragStart: (e: React.DragEvent, actorId: number) => void;
  handleNpcDragEnd: () => void;
  handleOpenActorDialog: (type: 'npc' | 'enemy') => void;
};

const SidebarActorArea: React.FC<Props> = ({
  isNpcLayer,
  isEnemyLayer,
  actorEntries,
  leftCollapsed,
  draggingNpcId,
  handleEditObject,
  setNpcHoverTooltip,
  handleNpcDragStart,
  handleNpcDragEnd,
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
      onHover={(pos) => setNpcHoverTooltip(pos)}
      onHoverEnd={() => setNpcHoverTooltip(null)}
      onDragStart={handleNpcDragStart}
      onDragEnd={handleNpcDragEnd}
      onAddNpc={() => handleOpenActorDialog('npc')}
      onAddEnemy={() => handleOpenActorDialog('enemy')}
    />
  );
};

export default SidebarActorArea;
