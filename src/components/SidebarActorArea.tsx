import React from 'react';
import SidebarActorEntries from '@/components/SidebarActorEntries';
import type { MapObject } from '@/types';

type Props = {
  isNpcLayer: boolean;
  isEnemyLayer: boolean;
  actorEntries: MapObject[];
  draggingNpcId: number | null;
  handleEditObject: (id: number) => void;
  handleEditEnemyTemplate: (id: number) => void;
  handleDuplicateObject: (id: number) => void;
  handleDeleteObject: (id: number) => void;
  handleNpcDragStart: (e: React.DragEvent, actorId: number) => void;
  handleNpcDragEnd: () => void;
  handleReorderActors: (fromIndex: number, toIndex: number) => void;
  handleOpenActorDialog: (type: 'npc' | 'enemy') => void;
  handleCreateActorShell?: (name: string, type?: 'npc' | 'enemy') => Promise<number | null>;
  projectPath?: string | null;
  mapName?: string;
};

const SidebarActorArea: React.FC<Props> = ({
  isNpcLayer,
  isEnemyLayer,
  actorEntries,
  draggingNpcId,
  handleEditObject,
  handleEditEnemyTemplate,
  handleDuplicateObject,
  handleDeleteObject,
  handleNpcDragStart,
  handleNpcDragEnd,
  handleReorderActors,
  handleOpenActorDialog,
  handleCreateActorShell,
  projectPath,
  mapName,
}) => {
  return (
    <SidebarActorEntries
      isNpcLayer={isNpcLayer}
      isEnemyLayer={isEnemyLayer}
      actorEntries={actorEntries}
      draggingNpcId={draggingNpcId}
      onEditObject={handleEditObject}
      onEditEnemyTemplate={handleEditEnemyTemplate}
      onDuplicateObject={handleDuplicateObject}
      onDeleteObject={handleDeleteObject}
      onDragStart={handleNpcDragStart}
      onDragEnd={handleNpcDragEnd}
      onReorderActors={handleReorderActors}
      onAddNpc={() => handleOpenActorDialog('npc')}
      onAddEnemy={() => handleOpenActorDialog('enemy')}
      onCreateActorShell={handleCreateActorShell}
      projectPath={projectPath}
      mapName={mapName}
    />
  );
};

export default SidebarActorArea;
