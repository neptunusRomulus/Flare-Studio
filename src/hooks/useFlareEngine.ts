import { useCallback, useEffect, useRef, useState } from 'react';

export type FlareLaunchMode = 'current-map' | 'new-game' | 'main-menu';

const FLARE_PATH_KEY = 'flarePath';

function getStoredFlarePath(): string | null {
  try {
    return localStorage.getItem(FLARE_PATH_KEY);
  } catch {
    return null;
  }
}

function setStoredFlarePath(p: string) {
  try {
    localStorage.setItem(FLARE_PATH_KEY, p);
  } catch { /* ignore */ }
}

interface UseFlareEngineArgs {
  currentProjectPath?: string | null;
  mapName?: string | null;
  onBeforeLaunch?: () => Promise<void>;
}

export default function useFlareEngine({ currentProjectPath, mapName, onBeforeLaunch }: UseFlareEngineArgs) {
  const [isRunning, setIsRunning] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [flarePath, setFlarePath] = useState<string | null>(getStoredFlarePath);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const exitHandlerRef = useRef<(() => void) | null>(null);

  // Listen for the exit event from main process
  useEffect(() => {
    const api = (window as unknown as { electronAPI?: { onFlareEngineExited?: (cb: () => void) => void } }).electronAPI;
    if (api?.onFlareEngineExited) {
      api.onFlareEngineExited(() => {
        setIsRunning(false);
        // Run any registered exit handler (e.g. restore spawn.txt backup)
        if (exitHandlerRef.current) {
          exitHandlerRef.current();
          exitHandlerRef.current = null;
        }
      });
    }
    const poll = pollRef.current;
    return () => {
      if (poll) clearInterval(poll);
    };
  }, []);

  // Prompt user to pick flare.exe via native file dialog. Returns the path or null.
  const promptSelectFlareExe = useCallback(async (): Promise<string | null> => {
    const api = (window as unknown as { electronAPI?: typeof window.electronAPI }).electronAPI;
    if (!api?.selectFlareExe) return null;
    const selected = await api.selectFlareExe();
    if (selected) {
      setFlarePath(selected);
      setStoredFlarePath(selected);
    }
    return selected;
  }, []);

  // Allow re-configuring the path from the UI (e.g. "Set Flare Location..." menu item)
  const configureFlarePath = useCallback(async () => {
    setLastError(null);
    const selected = await promptSelectFlareExe();
    if (!selected) {
      setLastError('No flare.exe selected');
    }
    return selected;
  }, [promptSelectFlareExe]);

  const launch = useCallback(async (mode: FlareLaunchMode) => {
    const api = (window as unknown as { electronAPI?: typeof window.electronAPI }).electronAPI;
    if (!api?.launchFlareEngine) {
      setLastError('Flare engine launcher not available (not running in Electron)');
      return;
    }

    setLastError(null);

    // If flarePath is not set, prompt user to pick it now
    let activeFlarePath = flarePath || getStoredFlarePath();
    if (!activeFlarePath) {
      activeFlarePath = await promptSelectFlareExe();
      if (!activeFlarePath) {
        setLastError('Flare engine path not configured. Please select flare.exe to continue.');
        return;
      }
    }

    // Auto-save before launching
    if (onBeforeLaunch) {
      try {
        await onBeforeLaunch();
      } catch (err) {
        console.warn('[FlareEngine] Pre-launch save failed:', err);
      }
    }

    // Build launch options
    const options: {
      flarePath: string;
      dataPath?: string;
      mods?: string[];
      loadSlot?: string;
    } = { flarePath: activeFlarePath };

    if (mode === 'current-map' || mode === 'new-game') {
      if (currentProjectPath) {
        // Ensure the project is accessible as a Flare mod (junction if needed)
        if (api.ensureFlareModLink) {
          const linkResult = await api.ensureFlareModLink({
            flarePath: activeFlarePath,
            projectPath: currentProjectPath,
          });
          if (!linkResult.success) {
            setLastError(linkResult.error || 'Failed to link project into Flare mods folder');
            return;
          }
          if (linkResult.junctionCreated) {
            console.log('[FlareEngine] Junction created for project mod');
          }
        }

        // The mod name is just the project folder name
        const normalized = currentProjectPath.replace(/\\/g, '/').replace(/\/$/, '');
        const parts = normalized.split('/');
        const modName = parts[parts.length - 1];

        // data-path = the Flare install directory (where mods/ folder lives)
        const flareDir = activeFlarePath.replace(/\\/g, '/').split('/').slice(0, -1).join('/');
        options.dataPath = flareDir;
        options.mods = ['fantasycore', modName];

        // Prepare quick-launch files: spawn.txt, gameplay.txt, save slot
        // This makes Flare skip the title screen and load directly into the map
        if (api.prepareFlareQuickLaunch) {
          const prepResult = await api.prepareFlareQuickLaunch({
            flarePath: activeFlarePath,
            projectPath: currentProjectPath,
            mapName: mapName || '',
            mode,
          });
          if (!prepResult.success) {
            setLastError(prepResult.error || 'Failed to prepare quick-launch files');
            return;
          }
          // Use the auto-found save slot to skip title screen entirely
          options.loadSlot = String(prepResult.slotNum);
          console.log(`[FlareEngine] Quick-launch prepared: slot ${prepResult.slotNum}`);
        }
      }
    }
    // mode === 'main-menu' — launch with --mods only to skip mod selection

    try {
      const result = await api.launchFlareEngine(options);
      if (result.success) {
        setIsRunning(true);

        // When Flare exits, restore the original spawn.txt from backup
        if ((mode === 'current-map' || mode === 'new-game') && currentProjectPath && api.restoreSpawnBackup) {
          const restoreOnExit = () => {
            api.restoreSpawnBackup!({ projectPath: currentProjectPath! }).catch((err: unknown) => {
              console.warn('[FlareEngine] Failed to restore spawn.txt backup:', err);
            });
          };
          // Set exit handler — will be called by the effect's onFlareEngineExited listener
          const originalHandler = exitHandlerRef.current;
          exitHandlerRef.current = () => {
            restoreOnExit();
            if (originalHandler) originalHandler();
          };
        }
      } else {
        setLastError(result.error || 'Failed to launch Flare engine');
      }
    } catch (err: unknown) {
      setLastError(err instanceof Error ? err.message : 'Unexpected error launching Flare');
    }
  }, [currentProjectPath, mapName, onBeforeLaunch, flarePath, promptSelectFlareExe]);

  return { launch, isRunning, lastError, flarePath, configureFlarePath };
}
