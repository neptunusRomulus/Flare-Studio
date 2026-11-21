import { useCallback, useEffect, useRef } from 'react';
import { exportFlareTextFiles } from '@/flare/manualSaveExport';
import { backupMapName } from '@/editor/saveHealth';
import { buildProjectBackup, normalizeProjectBackup, type MapSessionDraft } from '@/editor/projectSession';
import type { TileMapEditor } from '@/editor/TileMapEditor';
import { waitUntil } from '@/hooks/useCrashRecovery';

const PANEL_BACKUP_DELAY_MS = 8000;

type Args = {
  editor: TileMapEditor | null;
  projectPath: string | null;
  paused: boolean;
  editorDirty: boolean;
  mapDrafts: MapSessionDraft[];
  collectEditorDrafts: () => Record<string, { path: string; content: string }[]>;
  setMapDraft: (mapName: string, snapshot: Record<string, unknown>) => void;
  clearMapDraft: (mapName: string) => void;
  openMapForRecovery?: (name: string) => Promise<void>;
};

/** Enrich the crash file with every dirty map and editor, and write a backup when only panels are dirty. */
export function useProjectBackup(args: Args): {
  writeFullBackup: () => Promise<void>;
  rememberCurrentMap: () => void;
  saveInactiveMapDrafts: () => Promise<void>;
  restoreProjectBackup: (backup: unknown) => Promise<boolean>;
} {
  const argsRef = useRef(args);
  argsRef.current = args;

  const writeFullBackup = useCallback(async () => {
    const { editor, projectPath, paused, mapDrafts, collectEditorDrafts } = argsRef.current;
    if (paused || !projectPath || !window.electronAPI?.saveCrashBackup) return;
    const currentSnapshot = editor && typeof editor.buildCrashBackupSnapshot === 'function'
      ? editor.buildCrashBackupSnapshot()
      : null;
    const currentMapName = (currentSnapshot && backupMapName(currentSnapshot)) || (typeof editor?.getMapName === 'function' ? editor.getMapName() : null);
    const payload = buildProjectBackup({
      currentMapName,
      currentSnapshot,
      mapDrafts,
      editors: collectEditorDrafts(),
    });
    if (!payload.maps.length && !Object.keys(payload.editors).length) return;
    await window.electronAPI.saveCrashBackup(projectPath, payload);
  }, []);

  const rememberCurrentMap = useCallback(() => {
    const { editor, setMapDraft } = argsRef.current;
    if (!editor || typeof editor.buildCrashBackupSnapshot !== 'function') return;
    const snapshot = editor.buildCrashBackupSnapshot();
    const name = backupMapName(snapshot) || (typeof editor.getMapName === 'function' ? editor.getMapName() : '');
    if (name) setMapDraft(name, snapshot);
  }, []);

  useEffect(() => {
    const editor = args.editor;
    if (!editor || typeof editor.setCrashBackupEnricher !== 'function') return;
    editor.setCrashBackupEnricher(async (snapshot) => {
      const { paused, mapDrafts, collectEditorDrafts, setMapDraft } = argsRef.current;
      const name = backupMapName(snapshot) || '';
      if (name) setMapDraft(name, snapshot);
      if (paused) return snapshot;
      return buildProjectBackup({
        currentMapName: name,
        currentSnapshot: snapshot,
        mapDrafts,
        editors: collectEditorDrafts(),
      });
    });
    editor.setCrashBackupClearPolicy?.(
      () => {
        const { editorDirty, mapDrafts, collectEditorDrafts, editor: current } = argsRef.current;
        if (editorDirty) return false;
        if (Object.keys(collectEditorDrafts()).length) return false;
        const currentName = (typeof current?.getMapName === 'function' ? current.getMapName() : '') || '';
        return mapDrafts.every((draft) => draft.mapName.toLowerCase() === currentName.toLowerCase());
      },
      (mapName) => { argsRef.current.clearMapDraft(mapName); },
    );
    return () => {
      editor.setCrashBackupEnricher?.(null);
      editor.setCrashBackupClearPolicy?.(null, null);
    };
  }, [args.editor]);

  useEffect(() => {
    if (args.paused || !args.projectPath) return;
    if (!args.editorDirty && args.mapDrafts.length === 0) return;
    const timer = window.setTimeout(() => { void writeFullBackup(); }, PANEL_BACKUP_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [args.paused, args.projectPath, args.editorDirty, args.mapDrafts, writeFullBackup]);

  const saveInactiveMapDrafts = useCallback(async () => {
    const { editor, projectPath, mapDrafts, clearMapDraft } = argsRef.current;
    if (!editor || !projectPath || typeof editor.loadFromBackupData !== 'function') return;
    const currentName = typeof editor.getMapName === 'function' ? String(editor.getMapName() || '') : '';
    const others = mapDrafts.filter((draft) => draft.mapName.toLowerCase() !== currentName.toLowerCase());
    if (!others.length) return;

    const currentSnapshot = typeof editor.buildCrashBackupSnapshot === 'function' ? editor.buildCrashBackupSnapshot() : null;
    editor.setTabSwitching?.(true);
    try {
      for (const draft of others) {
        const loaded = editor.loadFromBackupData({ ...draft.snapshot, timestamp: Date.now() });
        if (!loaded) continue;
        editor.setTabSwitching?.(false);
        const exported = await exportFlareTextFiles(editor, projectPath);
        if (typeof editor.saveProjectData === 'function') {
          await editor.saveProjectData(projectPath, { mapName: draft.mapName });
        }
        editor.setTabSwitching?.(true);
        if (exported) {
          editor.markAsFullySaved?.();
          clearMapDraft(draft.mapName);
        }
      }
    } finally {
      if (currentSnapshot) editor.loadFromBackupData({ ...currentSnapshot, timestamp: Date.now() });
      editor.setTabSwitching?.(false);
      try { editor.redraw?.(); } catch { /* ignore */ }
    }
  }, []);

  const restoreProjectBackup = useCallback(async (backup: unknown): Promise<boolean> => {
    const parsed = normalizeProjectBackup(backup);
    if (!parsed) return false;
    const { editor, setMapDraft, openMapForRecovery } = argsRef.current;
    for (const draft of parsed.maps) setMapDraft(draft.mapName, draft.snapshot);

    const ordered = [...parsed.maps];
    const preferred = parsed.mapName;
    if (preferred) {
      ordered.sort((a, b) => Number(b.mapName.toLowerCase() === preferred.toLowerCase()) - Number(a.mapName.toLowerCase() === preferred.toLowerCase()));
    }

    for (const draft of ordered) {
      if (openMapForRecovery) {
        await openMapForRecovery(draft.mapName);
      }
      const ready = await waitUntil(() => {
        const current = argsRef.current.editor;
        if (!current || typeof current.loadFromBackupData !== 'function') return null;
        if (typeof current.getMapName === 'function') {
          const loadedName = String(current.getMapName() || '');
          if (loadedName && loadedName.toLowerCase() !== draft.mapName.toLowerCase()) return null;
        }
        return current;
      });
      if (!ready) continue;
      const loaded = ready.loadFromBackupData({ ...draft.snapshot, timestamp: Date.now() });
      if (loaded) {
        try { ready.redraw?.(); } catch { /* ignore */ }
      }
    }
    return !!(editor || argsRef.current.editor);
  }, []);

  return { writeFullBackup, rememberCurrentMap, saveInactiveMapDrafts, restoreProjectBackup };
}
