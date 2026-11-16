import React from 'react';
import WindowControls from '@/components/WindowControls';

type TitleBarProps = {
  saveStatus: 'saving' | 'saved' | 'unsaved' | 'error';
  lastSaveTime: number;
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
  flareIconUrl?: string | null;
  /** Replaces the plain logo: Flare icon as the app menu button + Save button. */
  appMenu?: React.ReactNode;
};

const TitleBar = ({
  saveStatus,
  onMinimize,
  onMaximize,
  onClose,
  flareIconUrl,
  appMenu,
}: TitleBarProps) => (
  <div className="bg-gray-100 dark:bg-neutral-900 text-orange-600 dark:text-orange-400 flex items-center justify-between px-4 py-1 select-none drag-region border-b border-gray-200 dark:border-neutral-700 min-h-0">
    <div className="flex items-center gap-3 min-w-0">
      <div className="flex items-center gap-1">
        {appMenu ?? (flareIconUrl ? (
          <img src={flareIconUrl} alt="Flare Studio Logo" className="w-4 h-6" />
        ) : null)}
        <span className="text-sm font-semibold text-orange-600 dark:text-orange-400 whitespace-nowrap">Flare Studio</span>
      </div>
      {(saveStatus === 'saving' || saveStatus === 'error') && (
        <div className="flex items-center gap-2 text-xs mx-4">
          {saveStatus === 'saving' && (
            <>
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse flex-shrink-0"></div>
              <span className="text-orange-600 whitespace-nowrap">Saving...</span>
            </>
          )}
          {saveStatus === 'error' && (
            <>
              <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></div>
              <span className="text-red-600 whitespace-nowrap">Save Error</span>
            </>
          )}
        </div>
      )}
    </div>
    <div className="flex items-center gap-2">
      <WindowControls onMinimize={onMinimize} onMaximize={onMaximize} onClose={onClose} />
    </div>
  </div>
);

export default TitleBar;
