import { useCallback, useEffect, useRef, useState } from 'react';
import { dataPathFromFlareSelection } from '@/flare/playLaunch';

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
    const api = (window as unknown as { electronAPI?: { onFlareEngineExited?: (cb: (payload?: { error?: string }) => void) => void } }).electronAPI;
    if (api?.onFlareEngineExited) {
      api.onFlareEngineExited((payload) => {
        setIsRunning(false);
        if (payload?.error) setLastError(payload.error);
        // Run any registered exit handler (restore the playtest save and misc.txt)
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

    // data-path is the directory that contains the executable (mods/ lives there).
    // A legacy stored folder is kept as-is; the main process confirms with stat.
    const options: {
      flarePath: string;
      dataPath?: string;
      projectPath?: string;
      mods?: string[];
      loadSlot?: string;
    } = {
      flarePath: activeFlarePath,
      dataPath: dataPathFromFlareSelection(activeFlarePath),
    };

    if (currentProjectPath) {
      options.projectPath = currentProjectPath;
      const normalized = currentProjectPath.replace(/\\/g, '/').replace(/\/$/, '');
      const modName = normalized.split('/').pop() || '';

      if (api.ensureFlareModLink) {
        const linkResult = await api.ensureFlareModLink({
          flarePath: activeFlarePath,
          projectPath: currentProjectPath,
        });
        if (!linkResult.success) {
          setLastError(linkResult.error || 'Failed to link project into the Flare mods folder');
          return;
        }
        if (linkResult.missingMods && linkResult.missingMods.length > 0) {
          setLastError(
            `Missing Flare mods: ${linkResult.missingMods.join(', ')}. Install them where Flare looks for mods, or remove them from settings.txt requires=.`
          );
          return;
        }
        options.mods = linkResult.mods && linkResult.mods.length > 0 ? linkResult.mods : [modName];
      } else if (modName) {
        options.mods = [modName];
      }

      // current-map and new-game skip the title screen via a temporary test save.
      if ((mode === 'current-map' || mode === 'new-game') && api.prepareFlareQuickLaunch) {
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
        if (prepResult.mods && prepResult.mods.length > 0) {
          options.mods = prepResult.mods;
        }
        const slot = prepResult.loadSlot ?? prepResult.slotNum;
        if (slot != null) {
          options.loadSlot = String(slot);
          console.log(`[FlareEngine] Quick-launch prepared: load-slot ${slot}`);
        }
      }
    }

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
