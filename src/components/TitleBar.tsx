import React from 'react';
import { Button } from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import { Minus, Plus, Settings, Square, X } from 'lucide-react';

type TabEntry = {
  id: string;
  name: string;
  tabType?: 'map' | 'enemy';
};

type TitleBarProps = {
  tabs: TabEntry[];
  activeTabId: string | null;
  onSwitchTab: (tabId: string) => void;
  onOpenMapSettings: () => void;
  onCloseEnemyTab: (tabId: string) => void;
  onCreateNewMap: () => void;
  saveStatus: 'saving' | 'saved' | 'unsaved' | 'error';
  lastSaveTime: number;
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
  flareIconUrl: string;
};

const TitleBar = ({
  tabs,
  activeTabId,
  onSwitchTab,
  onOpenMapSettings,
  onCloseEnemyTab,
  onCreateNewMap,
  saveStatus,
  lastSaveTime,
  onMinimize,
  onMaximize,
  onClose,
  flareIconUrl
}: TitleBarProps) => (
  <div className="bg-gray-100 dark:bg-neutral-900 text-orange-600 dark:text-orange-400 flex justify-between items-center px-4 py-1 select-none drag-region border-b border-gray-200 dark:border-neutral-700">
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1">
        <img
          src={flareIconUrl}
          alt="Flare Studio Logo"
          className="w-4 h-6"
        />
        <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">Flare Studio</span>
      </div>
      <div className="flex items-center gap-1 text-xs mx-4 min-w-[70px]">
        {saveStatus === 'saving' && (
          <>
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
            <span className="text-orange-600">Saving...</span>
          </>
        )}
        {saveStatus === 'saved' && lastSaveTime > 0 && (
          <>
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-green-600">Saved</span>
          </>
        )}
        {saveStatus === 'error' && (
          <>
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span className="text-red-600">Save Error</span>
          </>
        )}
        {saveStatus === 'unsaved' && (
          <>
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            <span className="text-gray-500">Unsaved</span>
          </>
        )}
      </div>
      <div className="ml-2 flex items-center gap-2 overflow-x-auto max-w-[60vw] no-drag">
        {tabs.map((tab) => (
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
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenMapSettings();
                  }}
                  className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded"
                  aria-label="Edit Map Settings"
                >
                  <Settings className="w-3 h-3" />
                </button>
              </Tooltip>
            )}
            {tab.tabType === 'enemy' && (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  if (tab.id !== activeTabId) {
                    onSwitchTab(tab.id);
                  }
                  onCloseEnemyTab(tab.id);
                }}
                className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10"
                aria-label="Close enemy tab"
                title="Close"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
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
      <div className="text-sm font-medium"></div>
    </div>
    <div className="flex no-drag">
      <Button
        variant="ghost"
        size="icon"
        onClick={onMinimize}
        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded transition-colors"
        aria-label="Minimize"
      >
        <Minus className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onMaximize}
        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded transition-colors"
        aria-label="Maximize"
      >
        <Square className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded transition-colors"
        aria-label="Close"
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  </div>
);

export default TitleBar;
