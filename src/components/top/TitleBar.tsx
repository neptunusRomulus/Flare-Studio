import React from 'react';
// removed unused Button import
import WindowControls from '@/components/WindowControls';
import PlayButton from '@/components/PlayButton';
import type { FlareLaunchMode } from '@/hooks/useFlareEngine';

type TitleBarProps = {
  saveStatus: 'saving' | 'saved' | 'unsaved' | 'error';
  lastSaveTime: number;
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
  flareIconUrl?: string | null;
  /** Replaces the plain logo: Flare icon as the app menu button + Save button. */
  appMenu?: React.ReactNode;
  // Flare engine play button
  flareEngine?: {
    isRunning: boolean;
    lastError: string | null;
    hasProject: boolean;
    hasMap: boolean;
    flarePath: string | null;
    onLaunch: (mode: FlareLaunchMode) => void;
    onConfigurePath: () => void;
  };
};

const TitleBar = ({
  saveStatus,
  lastSaveTime,
  onMinimize,
  onMaximize,
  onClose,
  flareIconUrl,
  appMenu,
  flareEngine
}: TitleBarProps) => (
  <div className="bg-gray-100 dark:bg-neutral-900 text-orange-600 dark:text-orange-400 grid grid-cols-[1fr_auto_1fr] items-center px-4 py-1 select-none drag-region border-b border-gray-200 dark:border-neutral-700 min-h-0">
    <div className="flex items-center gap-3 min-w-0 justify-self-start">
      <div className="flex items-center gap-1">
        {appMenu ?? (flareIconUrl ? (
          <img src={flareIconUrl} alt="Flare Studio Logo" className="w-4 h-6" />
        ) : null)}
        <span className="text-sm font-semibold text-orange-600 dark:text-orange-400 whitespace-nowrap">Flare Studio</span>
      </div>
      <div className="flex items-center gap-2 text-xs mx-4 min-w-[90px]">
        {saveStatus === 'saving' && (
          <>
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse flex-shrink-0"></div>
            <span className="text-orange-600 whitespace-nowrap">Saving...</span>
          </>
        )}
        {saveStatus === 'saved' && lastSaveTime > 0 && (
          <>
            <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
            <span className="text-green-600 whitespace-nowrap">Saved</span>
          </>
        )}
        {saveStatus === 'error' && (
          <>
            <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></div>
            <span className="text-red-600 whitespace-nowrap">Save Error</span>
          </>
        )}
        {saveStatus === 'unsaved' && (
          <>
            <div className="w-2 h-2 bg-gray-400 rounded-full flex-shrink-0"></div>
            <span className="text-gray-500 whitespace-nowrap">Unsaved</span>
          </>
        )}

      </div>
    </div>
    <div className="flex items-center justify-center no-drag">
      {flareEngine ? (
        <PlayButton
          isRunning={flareEngine.isRunning}
          lastError={flareEngine.lastError}
          hasProject={flareEngine.hasProject}
          hasMap={flareEngine.hasMap}
          flarePath={flareEngine.flarePath}
          onLaunch={flareEngine.onLaunch}
          onConfigurePath={flareEngine.onConfigurePath}
        />
      ) : null}
    </div>
    <div className="flex items-center gap-2 justify-self-end">
      <WindowControls onMinimize={onMinimize} onMaximize={onMaximize} onClose={onClose} />
    </div>
  </div>
);

export default TitleBar;
