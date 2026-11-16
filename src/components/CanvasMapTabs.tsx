import React from 'react';
import { Button } from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import { GripVertical, Plus, X } from 'lucide-react';
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
  onCloseTab: (tabId: string) => void;
  onCreateNewMap: () => void;
};

/** Pink hanging strip at the top-center of the canvas. Inward-curved bottom corners. */
export default function CanvasMapTabs({
  tabs = [],
  activeTabId,
  onSwitchTab,
  onOpenMapSettings,
  onCloseTab,
  onCreateNewMap,
}: Props) {
  if (tabs.length === 0) return null;
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];

  return (
    <div className="absolute top-0 left-1/2 z-20 flex -translate-x-1/2 justify-center pointer-events-none">
      <div className="canvas-map-tabs pointer-events-auto relative flex h-7 max-w-[min(100%,42rem)] items-center gap-0.5 px-1.5 text-neutral-800">
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 200 28"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            className="text-[#f0b6d4] dark:text-[#c97eae]"
            d="M0,0 H200 V18 A10,10 0 0 0 190,28 H10 A10,10 0 0 0 0,18 Z"
          />
        </svg>
        <Tooltip content={activeTab.tabType === 'enemy' ? 'Close tab' : 'Close map tab'} side="bottom">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => { if (activeTab) onCloseTab(activeTab.id); }}
            className="relative z-[1] h-5 w-5 shrink-0 rounded-sm p-0 text-neutral-700 hover:bg-black/10 hover:text-neutral-900 dark:text-neutral-100 dark:hover:bg-white/15"
            aria-label={activeTab.tabType === 'enemy' ? 'Close tab' : 'Close map tab'}
          >
            <X className="h-3 w-3" />
          </Button>
        </Tooltip>
        <span
          className="relative z-[1] inline-flex h-5 w-3.5 shrink-0 items-center justify-center text-neutral-600 dark:text-neutral-200"
          aria-hidden="true"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>
        <div className="relative z-[1] flex min-w-0 items-center gap-0.5 overflow-x-auto no-drag">
          {tabs.map((tab) => (
            <TabItem
              key={tab.id}
              tab={tab}
              activeTabId={activeTabId}
              onSwitchTab={onSwitchTab}
              onOpenMapSettings={onOpenMapSettings}
              onCloseEnemyTab={onCloseTab}
              variant="canvas"
            />
          ))}
        </div>
        <Tooltip content="Create a new map" side="bottom">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCreateNewMap}
            className="relative z-[1] h-5 w-5 shrink-0 rounded-sm p-0 text-neutral-700 hover:bg-black/10 hover:text-neutral-900 dark:text-neutral-100 dark:hover:bg-white/15 no-drag"
            aria-label="Create new map"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
