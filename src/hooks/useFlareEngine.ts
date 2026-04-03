import { useCallback, useEffect, useRef, useState } from 'react';

export type FlareLaunchMode = 'current-map' | 'new-game' | 'main-menu';

interface UseFlareEngineArgs {
  currentProjectPath?: string | null;
  mapName?: string | null;
  onBeforeLaunch?: () => Promise<void>;
}

export default function useFlareEngine({ currentProjectPath, mapName, onBeforeLaunch }: UseFlareEngineArgs) {
  const [isRunning, setIsRunning] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Listen for the exit event from main process
  useEffect(() => {
    const api = (window as unknown as { electronAPI?: { onFlareEngineExited?: (cb: () => void) => void } }).electronAPI;
    if (api?.onFlareEngineExited) {
      api.onFlareEngineExited(() => {
        setIsRunning(false);
      });
    }
    const poll = pollRef.current;
    return () => {
      if (poll) clearInterval(poll);
    };
  }, []);

  const launch = useCallback(async (mode: FlareLaunchMode) => {
    const api = (window as unknown as { electronAPI?: typeof window.electronAPI }).electronAPI;
    if (!api?.launchFlareEngine) {
      setLastError('Flare engine launcher not available (not running in Electron)');
      return;
    }

    setLastError(null);

    // Auto-save before launching
    if (onBeforeLaunch) {
      try {
        await onBeforeLaunch();
      } catch (err) {
        console.warn('[FlareEngine] Pre-launch save failed:', err);
        // Continue anyway — user might want to test even without latest save
      }
    }

    // Build launch options based on the mode
    const options: {
      dataPath?: string;
      mods?: string[];
      loadScript?: string;
    } = {};

    if (mode === 'current-map' || mode === 'new-game') {
      if (currentProjectPath) {
        // The project path is something like D:\Flare\mods\testNPC
        // We need data-path = parent of "mods" dir, and mod name = folder name
        const normalized = currentProjectPath.replace(/\\/g, '/').replace(/\/$/, '');
        const parts = normalized.split('/');
        const modName = parts[parts.length - 1]; // e.g. "testNPC"

        // Find the "mods" segment and set data-path to its parent
        const modsIndex = parts.lastIndexOf('mods');
        if (modsIndex >= 0) {
          const dataPath = parts.slice(0, modsIndex).join('/');
          options.dataPath = dataPath;
        }
        // Always include fantasycore + default as base mods, then the project mod on top
        options.mods = ['fantasycore', modName];
      }

      if (mode === 'current-map' && mapName) {
        options.loadScript = mapName;
      }
    }
    // mode === 'main-menu' — launch with no special args

    try {
      const result = await api.launchFlareEngine(options);
      if (result.success) {
        setIsRunning(true);
      } else {
        setLastError(result.error || 'Failed to launch Flare engine');
      }
    } catch (err: unknown) {
      setLastError(err instanceof Error ? err.message : 'Unexpected error launching Flare');
    }
  }, [currentProjectPath, mapName, onBeforeLaunch]);

  return { launch, isRunning, lastError };
}
