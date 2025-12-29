import { useCallback, useEffect } from 'react';
import type React from 'react';
import type { TileMapEditor } from '@/editor/TileMapEditor';

export default function useManualSave(args: {
  editor?: TileMapEditor | null;
  currentProjectPath?: string | null;
  setIsManuallySaving: (v: boolean) => void;
  setLastSaveTime: (t: number) => void;
  manualSaveRef?: React.MutableRefObject<(() => Promise<void>) | undefined>;
}) {
  const { editor, currentProjectPath, setIsManuallySaving, setLastSaveTime } = args;

  const handleManualSave = useCallback(async () => {
    if (!editor) return;
    setIsManuallySaving(true);
    try {
      const api = (typeof window !== 'undefined') ? (window as unknown as { electronAPI?: { save?: () => void } }).electronAPI : undefined;
      if (api && currentProjectPath) {
        const success = await editor.saveProjectData(currentProjectPath);
        await new Promise(resolve => setTimeout(resolve, 300));
        if (success) {
          setLastSaveTime(Date.now());
        }
      } else {
        // web/local fallback
        try {
          const maybe = editor as unknown as { forceSave?: () => void };
          if (typeof maybe.forceSave === 'function') maybe.forceSave();
        } catch {
          // ignore
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Save error:', error);
    } finally {
      setIsManuallySaving(false);
    }
  }, [editor, currentProjectPath, setIsManuallySaving, setLastSaveTime]);

  // Optionally populate a stable ref so callers (IPC) can call the latest implementation
  useEffect(() => {
    if (args.manualSaveRef) {
      args.manualSaveRef.current = handleManualSave;
      return () => { if (args.manualSaveRef) args.manualSaveRef.current = undefined; };
    }
    return undefined;
  }, [handleManualSave, args.manualSaveRef]);

  return { handleManualSave };
}
