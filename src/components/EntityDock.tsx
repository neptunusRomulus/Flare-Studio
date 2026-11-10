import React from 'react';
import type { TileLayer } from '@/types';
import MapTargetSwitch, { type LayerVisibilityControls } from '@/components/MapTargetSwitch';
import SidebarActorArea from '@/components/SidebarActorArea';
import SidebarEventArea from '@/components/SidebarEventArea';
import { ENTITY_GROUP } from '@/components/targetGroups';
import { entityPlacement } from '@/components/entityPlacement';

type Props = {
  layers: TileLayer[];
  activeLayer: TileLayer | null;
  onSelectLayer: (id: number) => void;
  actors: Omit<React.ComponentProps<typeof SidebarActorArea>, 'isNpcLayer' | 'isEnemyLayer' | 'projectPath' | 'mapName'>;
  events: Omit<React.ComponentProps<typeof SidebarEventArea>, 'isEventLayer'>;
  visibility?: LayerVisibilityControls;
  projectPath?: string | null;
  mapName?: string;
};

/** Right dock content for the Entities layer: existing lists on top + target switch below (same as Map dock) NPC/Enemy/Event lists. */
const EntityDock: React.FC<Props> = ({ layers, activeLayer, onSelectLayer, actors, events, visibility, projectPath, mapName }) => {
  const type = activeLayer?.type;
  // Switching target (or leaving Entities) cancels a pending click-to-place
  React.useEffect(() => { entityPlacement.clear(); return () => entityPlacement.clear(); }, [type]);
  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Sub-switch right under the main switch (tree-like); list fills the space below */}
      <MapTargetSwitch group={ENTITY_GROUP} layers={layers} activeLayer={activeLayer} onSelectLayer={onSelectLayer} visibility={visibility} />
      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
        {(type === 'npc' || type === 'enemy') && (
          <SidebarActorArea {...actors} isNpcLayer={type === 'npc'} isEnemyLayer={type === 'enemy'} projectPath={projectPath} mapName={mapName} />
        )}
        {type === 'event' && <SidebarEventArea {...events} isEventLayer />}
      </div>
    </div>
  );
};

export default EntityDock;
