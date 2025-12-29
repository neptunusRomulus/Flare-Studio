import React from 'react';
import Tooltip from '@/components/ui/tooltip';
import { Settings, X } from 'lucide-react';

type TabEntry = { id: string; name: string; tabType?: 'map' | 'enemy' };

type Props = {
  tab: TabEntry;
  activeTabId: string | null;
  onSwitchTab: (tabId: string) => void;
  onOpenMapSettings: () => void;
  onCloseEnemyTab: (tabId: string) => void;
};

export default function TabItem({ tab, activeTabId, onSwitchTab, onOpenMapSettings, onCloseEnemyTab }: Props) {
  return (
    <div
      key={tab.id}
      className={`flex items-center gap-1 px-3 py-1 rounded-t-md border border-b-0 text-sm truncate max-w-xs no-drag transition-all duration-200 ${tab.id === activeTabId ? 'bg-orange-500 text-white border-orange-500' : 'bg-transparent text-gray-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-neutral-700'}`}
    >
      <button
        onClick={() => { onSwitchTab(tab.id); }}
        className="truncate"
        title={tab.name}
      >
        {tab.name}
      </button>
      {tab.id === activeTabId && tab.tabType !== 'enemy' && (
        <Tooltip content="Edit Map Settings" side="bottom">
          <button
            onClick={(event) => { event.stopPropagation(); onOpenMapSettings(); }}
            className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded"
            aria-label="Edit Map Settings"
          >
            <Settings className="w-3 h-3" />
          </button>
        </Tooltip>
      )}
      {tab.tabType === 'enemy' && (
        <button
          onClick={(event) => { event.stopPropagation(); if (tab.id !== activeTabId) onSwitchTab(tab.id); onCloseEnemyTab(tab.id); }}
          className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10"
          aria-label="Close enemy tab"
          title="Close"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
