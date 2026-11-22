import { useEffect, useRef, useState } from 'react';
import useCrashRecovery from '@/hooks/useCrashRecovery';
import { useProjectBackup } from '@/hooks/useProjectBackup';
import { normalizeProjectBackup } from '@/editor/projectSession';
import { useSaveHealth } from '@/context/SaveHealthContext';

/** What a restored backup told us about the map that is now open. */
export type RestoredMap = { name: string; width?: number; height?: number };

type EditorLike = Parameters<typeof useProjectBackup>[0]['editor'];

type SaveHealth = ReturnType<typeof useSaveHealth>;

type Args = {
  editor: EditorLike;
  projectPath: string | null;
  openMapForRecovery: (name: string) => Promise<void> | void;
  saveHealth: SaveHealth;
  onMapRestored: (map: RestoredMap) => void;
};

/**
 * Crash-recovery dialog plus the periodic project backup.
 *
 * Restoring has to happen through a ref: useProjectBackup needs the restore
 * callback while building its own result, so the callback can only reach the
 * real implementation on a later render.
 */
export function useProjectRecovery({ editor, projectPath, openMapForRecovery, saveHealth, onMapRestored }: Args) {
  const { editorDirty, collectEditorDrafts, hydrateEditorDrafts, mapDrafts, setMapDraft, clearMapDraft } = saveHealth;
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const openMapForRecoveryRef = useRef(openMapForRecovery);
  openMapForRecoveryRef.current = openMapForRecovery;
  const restoreProjectBackupRef = useRef<(backup: unknown) => Promise<boolean>>(async () => false);

  const {
    hasCrashBackup,
    mapName: crashedMapName,
    isRecovering,
    recoveryError,
    recoverSession,
    dismissRecovery,
    getCrashTimeFormatted,
    getTimeSinceCrash,
  } = useCrashRecovery({
    projectPath,
    onRecoveryFound: () => setShowRecoveryDialog(true),
    onRecoveryDismissed: () => setShowRecoveryDialog(false),
    onRecoverBackup: async (backup: unknown) => restoreProjectBackupRef.current(backup),
  });

  const { saveInactiveMapDrafts, restoreProjectBackup, rememberCurrentMap } = useProjectBackup({
    editor,
    projectPath,
    paused: hasCrashBackup,
    editorDirty,
    mapDrafts,
    collectEditorDrafts,
    setMapDraft,
    clearMapDraft,
    openMapForRecovery: async (name: string) => {
      if (typeof openMapForRecoveryRef.current === 'function') await openMapForRecoveryRef.current(name);
    },
  });

  restoreProjectBackupRef.current = async (backup: unknown) => {
    const parsed = normalizeProjectBackup(backup);
    if (parsed?.editors) hydrateEditorDrafts(parsed.editors);
    const ok = await restoreProjectBackup(backup);
    const current = editorRef.current;
    if (current) {
      const restoredName = current && typeof current.getMapName === 'function' ? current.getMapName() : '';
      const wanted = String(restoredName || parsed?.mapName || '').toLowerCase();
      const snap =
        parsed?.maps.find((entry) => entry.mapName.toLowerCase() === wanted)?.snapshot || parsed?.maps[0]?.snapshot;
      onMapRestored({
        name: restoredName,
        width: typeof snap?.mapWidth === 'number' ? snap.mapWidth : undefined,
        height: typeof snap?.mapHeight === 'number' ? snap.mapHeight : undefined,
      });
    }
    return ok;
  };

  useEffect(() => {
    editor?.setCrashBackupPaused?.(hasCrashBackup);
    return () => {
      editor?.setCrashBackupPaused?.(false);
    };
  }, [editor, hasCrashBackup]);

  const handleRecover = async () => {
    const success = await recoverSession();
    if (success) setShowRecoveryDialog(false);
  };

  const handleDismiss = () => {
    dismissRecovery();
    setShowRecoveryDialog(false);
  };

  return {
    showRecoveryDialog,
    hasCrashBackup,
    crashedMapName,
    isRecovering,
    recoveryError,
    getCrashTimeFormatted,
    getTimeSinceCrash,
    handleRecover,
    handleDismiss,
    saveInactiveMapDrafts,
    rememberCurrentMap,
  };
}
