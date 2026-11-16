import React from 'react';
import type { TileLayer } from '@/types';
import SidebarItemsArea from '@/components/SidebarItemsArea';
import SidebarStatusesArea from '@/components/SidebarStatusesArea';
import SidebarRulesArea from '@/components/SidebarRulesArea';
import SidebarBooksArea from '@/components/SidebarBooksArea';

type Props = {
  layers: TileLayer[];
  activeLayer: TileLayer | null;
  onSelectLayer: (id: number) => void;
  items: React.ComponentProps<typeof SidebarItemsArea>;
  statuses: React.ComponentProps<typeof SidebarStatusesArea>;
  rules: React.ComponentProps<typeof SidebarRulesArea>;
  projectPath?: string | null;
};

/** Right dock content for the Content layer: existing Items / Statuses / Quests lists on top, target switch below. */
const ContentDock: React.FC<Props> = ({ layers, activeLayer, onSelectLayer, items, statuses, rules, projectPath }) => {
  const type = activeLayer?.type;
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
        {type === 'items' && <SidebarItemsArea {...items} />}
        {type === 'books' && <SidebarBooksArea projectPath={projectPath} />}
        {type === 'status' && <SidebarStatusesArea {...statuses} />}
        {type === 'rules' && <SidebarRulesArea {...rules} />}
      </div>
    </div>
  );
};

export default ContentDock;
