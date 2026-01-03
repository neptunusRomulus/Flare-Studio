import React from 'react';
// removed unused Button and lucide-react imports
import EditorTabs from './EditorTabs';
import WindowControls from './WindowControls';

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
  flareIconUrl?: string | null;
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
        {flareIconUrl ? (
          <img src={flareIconUrl} alt="Flare Studio Logo" className="w-4 h-6" />
        ) : null}
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
      <EditorTabs
        tabs={tabs}
        activeTabId={activeTabId}
        onSwitchTab={onSwitchTab}
        onOpenMapSettings={onOpenMapSettings}
        onCloseEnemyTab={onCloseEnemyTab}
        onCreateNewMap={onCreateNewMap}
      />
      <div className="text-sm font-medium"></div>
    </div>
    <WindowControls onMinimize={onMinimize} onMaximize={onMaximize} onClose={onClose} />
  </div>
);

export default TitleBar;
