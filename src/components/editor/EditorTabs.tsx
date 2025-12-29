import React from 'react';
import Tooltip from '@/components/ui/tooltip';
import { Plus } from 'lucide-react';
import TabItem from '@/components/editor/TabItem';

type TabEntry = {
  id: string;
  name: string;
  tabType?: 'map' | 'enemy';
};

type Props = {
  tabs: TabEntry[];
  activeTabId: string | null;
  onSwitchTab: (tabId: string) => void;
  onOpenMapSettings: () => void;
  onCloseEnemyTab: (tabId: string) => void;
  onCreateNewMap: () => void;
};

export default function EditorTabs({
  tabs,
  activeTabId,
  onSwitchTab,
  onOpenMapSettings,
  onCloseEnemyTab,
  onCreateNewMap
}: Props) {
  return (
    <div className="ml-2 flex items-center gap-2 overflow-x-auto max-w-[60vw] no-drag">
      {tabs.map((tab) => (
        <TabItem
          key={tab.id}
          tab={tab}
          activeTabId={activeTabId}
          onSwitchTab={onSwitchTab}
          onOpenMapSettings={onOpenMapSettings}
          onCloseEnemyTab={onCloseEnemyTab}
        />
      ))}
      <Tooltip content="Create a new map" side="right">
        <button
          onClick={onCreateNewMap}
          className="ml-1 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-neutral-800 no-drag"
          aria-label="Create new map"
        >
          <Plus className="w-4 h-4 text-orange-600 dark:text-orange-400" />
        </button>
      </Tooltip>
    </div>
  );
}
