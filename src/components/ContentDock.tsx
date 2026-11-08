import React from 'react';
import type { TileLayer } from '@/types';
import MapTargetSwitch from '@/components/MapTargetSwitch';
import SidebarItemsArea from '@/components/SidebarItemsArea';
import SidebarStatusesArea from '@/components/SidebarStatusesArea';
import SidebarRulesArea from '@/components/SidebarRulesArea';
import { CONTENT_GROUP } from '@/components/targetGroups';

type Props = {
  layers: TileLayer[];
  activeLayer: TileLayer | null;
  onSelectLayer: (id: number) => void;
  items: React.ComponentProps<typeof SidebarItemsArea>;
  statuses: React.ComponentProps<typeof SidebarStatusesArea>;
  rules: React.ComponentProps<typeof SidebarRulesArea>;
};

/** Right dock content for the Content layer: existing Items / Statuses / Quests lists on top, target switch below. */
const ContentDock: React.FC<Props> = ({ layers, activeLayer, onSelectLayer, items, statuses, rules }) => {
  const type = activeLayer?.type;
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
        {type === 'items' && <SidebarItemsArea {...items} />}
        {type === 'status' && <SidebarStatusesArea {...statuses} />}
        {type === 'rules' && <SidebarRulesArea {...rules} />}
      </div>
      {/* Same layout as the Map dock: content on top, target switch below */}
      <MapTargetSwitch group={CONTENT_GROUP} layers={layers} activeLayer={activeLayer} onSelectLayer={onSelectLayer} />
    </div>
  );
};

export default ContentDock;
