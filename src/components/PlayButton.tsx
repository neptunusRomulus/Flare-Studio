import React, { useState, useRef, useEffect } from 'react';
import type { FlareLaunchMode } from '@/hooks/useFlareEngine';

interface PlayButtonProps {
  isRunning: boolean;
  lastError: string | null;
  hasProject: boolean;
  hasMap: boolean;
  flarePath: string | null;
  onLaunch: (mode: FlareLaunchMode) => void;
  onConfigurePath: () => void;
}

const PlayButton: React.FC<PlayButtonProps> = ({ isRunning, lastError, hasProject, hasMap, flarePath, onLaunch, onConfigurePath }) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const handleSelect = (mode: FlareLaunchMode) => {
    setOpen(false);
    onLaunch(mode);
  };

  return (
    <div ref={menuRef} className="relative no-drag">
      {/* Main play button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        disabled={isRunning}
        className={`
          flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold transition-all
          ${isRunning
            ? 'bg-orange-200 dark:bg-orange-900 text-orange-600 dark:text-orange-300 cursor-wait'
            : 'bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-500 text-white cursor-pointer'
          }
        `}
        title={isRunning ? 'Flare engine is running' : 'Launch Flare engine'}
      >
        {isRunning ? (
          <>
            <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
            <span>Running</span>
          </>
        ) : (
          <>
            {/* Play triangle icon */}
            <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor" className="flex-shrink-0">
              <polygon points="0,0 10,6 0,12" />
            </svg>
            <span>Play</span>
            {/* Dropdown caret */}
            <svg width="8" height="5" viewBox="0 0 8 5" fill="currentColor" className="ml-0.5 opacity-70">
              <polygon points="0,0 8,0 4,5" />
            </svg>
          </>
        )}
      </button>

      {/* Dropdown menu */}
      {open && !isRunning && (
        <div className="absolute top-full left-0 mt-1 z-50 min-w-[200px] bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-600 rounded-md shadow-lg py-1 text-sm">
          <button
            onClick={() => handleSelect('current-map')}
            disabled={!hasProject || !hasMap}
            className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor" className="text-green-500 flex-shrink-0">
              <polygon points="0,0 10,6 0,12" />
            </svg>
            <div>
              <div className="font-medium text-gray-800 dark:text-gray-200">Play Current Map</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Save &amp; launch into this map</div>
            </div>
          </button>

          <button
            onClick={() => handleSelect('new-game')}
            disabled={!hasProject}
            className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-500 flex-shrink-0">
              <rect x="1" y="1" width="10" height="10" rx="2" />
            </svg>
            <div>
              <div className="font-medium text-gray-800 dark:text-gray-200">New Game</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Save &amp; play from beginning</div>
            </div>
          </button>

          <div className="border-t border-gray-200 dark:border-neutral-600 my-1" />

          <button
            onClick={() => handleSelect('main-menu')}
            className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 flex items-center gap-2"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className="text-orange-500 flex-shrink-0">
              <circle cx="6" cy="6" r="5" />
            </svg>
            <div>
              <div className="font-medium text-gray-800 dark:text-gray-200">Flare Main Menu</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Launch engine title screen</div>
            </div>
          </button>

          {lastError && (
            <>
              <div className="border-t border-gray-200 dark:border-neutral-600 my-1" />
              <div className="px-3 py-1.5 text-xs text-red-500">{lastError}</div>
            </>
          )}

          <div className="border-t border-gray-200 dark:border-neutral-600 my-1" />

          <button
            onClick={() => { setOpen(false); onConfigurePath(); }}
            className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 flex items-center gap-2"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-500 flex-shrink-0">
              <path d="M10.5 6.5v3a1 1 0 01-1 1h-7a1 1 0 01-1-1v-7a1 1 0 011-1h3" />
              <path d="M8 1.5h2.5V4" />
              <path d="M5.5 6.5L10.5 1.5" />
            </svg>
            <div>
              <div className="font-medium text-gray-800 dark:text-gray-200">
                {flarePath ? 'Change Flare Location...' : 'Set Flare Location...'}
              </div>
              {flarePath ? (
                <div className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[220px]" title={flarePath}>{flarePath}</div>
              ) : (
                <div className="text-xs text-amber-500">Select flare.exe to enable play</div>
              )}
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

export default PlayButton;
