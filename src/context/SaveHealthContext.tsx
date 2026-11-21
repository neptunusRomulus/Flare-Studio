import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { writeProjectFiles } from '@/editor/projectFiles';
import type { EditorFileDraft, MapSessionDraft } from '@/editor/projectSession';

export type DirtySaveFn = () => Promise<void> | void;

type SourceEntry = {
  dirty: boolean;
  save?: DirtySaveFn;
  files?: EditorFileDraft[];
  mounted: boolean;
};

type SaveHealthContextValue = {
  sources: Record<string, boolean>;
  editorDirty: boolean;
  mapDrafts: MapSessionDraft[];
  setSource: (id: string, dirty: boolean, save?: DirtySaveFn, files?: EditorFileDraft[], mounted?: boolean) => void;
  clearSource: (id: string) => void;
  saveDirtySources: (projectPath?: string | null) => Promise<void>;
  collectEditorDrafts: () => Record<string, EditorFileDraft[]>;
  hydrateEditorDrafts: (editors: Record<string, EditorFileDraft[]>) => void;
  takeEditorDraft: (id: string) => EditorFileDraft[] | undefined;
  setMapDraft: (mapName: string, snapshot: Record<string, unknown>) => void;
  clearMapDraft: (mapName: string) => void;
  clearAllMapDrafts: () => void;
};

const SaveHealthContext = createContext<SaveHealthContextValue | null>(null);

function normalizeMapName(name: string): string {
  return name.trim();
}

export function SaveHealthProvider({ children }: { children: React.ReactNode }) {
  const [sources, setSources] = useState<Record<string, boolean>>({});
  const [mapDrafts, setMapDrafts] = useState<MapSessionDraft[]>([]);
  const entriesRef = useRef<Record<string, SourceEntry>>({});
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;

  const setSource = useCallback((id: string, dirty: boolean, save?: DirtySaveFn, files?: EditorFileDraft[], mounted = true) => {
    const prev = entriesRef.current[id];
    // A remounted editor often starts clean (it reloads from disk). Do not throw away a
    // surviving unmounted draft until the editor itself reports dirty or a save clears it.
    if (!dirty && mounted && prev?.dirty && prev.files?.length && !files) {
      entriesRef.current[id] = { ...prev, save: save ?? prev.save, mounted: true };
      setSources((current) => (current[id] === true ? current : { ...current, [id]: true }));
      return;
    }
    entriesRef.current[id] = {
      dirty,
      save: save ?? prev?.save,
      files: dirty ? (files ?? prev?.files) : undefined,
      mounted,
    };
    setSources((current) => (current[id] === dirty ? current : { ...current, [id]: dirty }));
  }, []);

  const clearSource = useCallback((id: string) => {
    delete entriesRef.current[id];
    setSources((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const saveDirtySources = useCallback(async (projectPath?: string | null) => {
    const dirtyIds = Object.entries(sourcesRef.current).filter(([, dirty]) => dirty).map(([id]) => id);
    for (const id of dirtyIds) {
      const entry = entriesRef.current[id];
      if (!entry) continue;
      if (entry.mounted && entry.save) {
        await entry.save();
        continue;
      }
      if (entry.files?.length && projectPath) {
        const saved = await writeProjectFiles(projectPath, entry.files);
        if (saved) {
          delete entriesRef.current[id];
          setSources((prev) => {
            if (!(id in prev)) return prev;
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }
        continue;
      }
      if (entry.save) await entry.save();
    }
  }, []);

  const collectEditorDrafts = useCallback((): Record<string, EditorFileDraft[]> => {
    const out: Record<string, EditorFileDraft[]> = {};
    for (const [id, entry] of Object.entries(entriesRef.current)) {
      if (!entry.dirty || !entry.files?.length) continue;
      out[id] = entry.files;
    }
    return out;
  }, []);

  const hydrateEditorDrafts = useCallback((editors: Record<string, EditorFileDraft[]>) => {
    setSources((prev) => {
      const next = { ...prev };
      for (const [id, files] of Object.entries(editors)) {
        if (!files.length) continue;
        const prevEntry = entriesRef.current[id];
        entriesRef.current[id] = { dirty: true, save: prevEntry?.save, files, mounted: prevEntry?.mounted ?? false };
        next[id] = true;
      }
      return next;
    });
  }, []);

  const takeEditorDraft = useCallback((id: string): EditorFileDraft[] | undefined => {
    const files = entriesRef.current[id]?.files;
    return files?.length ? files : undefined;
  }, []);

  const setMapDraft = useCallback((mapName: string, snapshot: Record<string, unknown>) => {
    const name = normalizeMapName(mapName);
    if (!name) return;
    setMapDrafts((prev) => {
      const rest = prev.filter((draft) => draft.mapName.toLowerCase() !== name.toLowerCase());
      return [...rest, { mapName: name, snapshot: { ...snapshot, mapName: name } }];
    });
  }, []);

  const clearMapDraft = useCallback((mapName: string) => {
    const name = normalizeMapName(mapName);
    setMapDrafts((prev) => prev.filter((draft) => draft.mapName.toLowerCase() !== name.toLowerCase()));
  }, []);

  const clearAllMapDrafts = useCallback(() => { setMapDrafts([]); }, []);

  const editorDirty = useMemo(() => Object.values(sources).some(Boolean), [sources]);

  const value = useMemo<SaveHealthContextValue>(() => ({
    sources,
    editorDirty,
    mapDrafts,
    setSource,
    clearSource,
    saveDirtySources,
    collectEditorDrafts,
    hydrateEditorDrafts,
    takeEditorDraft,
    setMapDraft,
    clearMapDraft,
    clearAllMapDrafts,
  }), [sources, editorDirty, mapDrafts, setSource, clearSource, saveDirtySources, collectEditorDrafts, hydrateEditorDrafts, takeEditorDraft, setMapDraft, clearMapDraft, clearAllMapDrafts]);

  return <SaveHealthContext.Provider value={value}>{children}</SaveHealthContext.Provider>;
}

export function useSaveHealth(): SaveHealthContextValue {
  const ctx = useContext(SaveHealthContext);
  if (!ctx) throw new Error('useSaveHealth must be used within SaveHealthProvider');
  return ctx;
}

export function useSaveHealthOptional(): SaveHealthContextValue | null {
  return useContext(SaveHealthContext);
}

/** Report an editor's dirty flag, optional save, and optional file snapshot. Dirty sources survive unmount. */
export function useRegisterDirty(
  id: string,
  dirty: boolean,
  save?: DirtySaveFn,
  files?: EditorFileDraft[],
  onRestore?: (files: EditorFileDraft[]) => void,
): void {
  const ctx = useSaveHealthOptional();
  const setSource = ctx?.setSource;
  const clearSource = ctx?.clearSource;
  const takeEditorDraft = ctx?.takeEditorDraft;
  const saveRef = useRef(save);
  saveRef.current = save;
  const filesRef = useRef(files);
  filesRef.current = files;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const restoreRef = useRef(onRestore);
  restoreRef.current = onRestore;
  const restoredRef = useRef(false);
  const hasSave = typeof save === 'function';

  useEffect(() => {
    if (restoredRef.current || !takeEditorDraft || !restoreRef.current) return;
    const draft = takeEditorDraft(id);
    if (draft?.length) {
      restoredRef.current = true;
      restoreRef.current(draft);
    }
  }, [id, takeEditorDraft]);

  useEffect(() => {
    if (!setSource) return;
    const run = hasSave ? () => Promise.resolve(saveRef.current?.()) : undefined;
    setSource(id, dirty, run, filesRef.current, true);
  }, [setSource, id, dirty, hasSave, files]);

  useEffect(() => {
    if (!setSource || !clearSource) return;
    return () => {
      if (dirtyRef.current) {
        const run = hasSave ? () => Promise.resolve(saveRef.current?.()) : undefined;
        setSource(id, true, run, filesRef.current, false);
      } else {
        clearSource(id);
      }
    };
  }, [setSource, clearSource, id, hasSave]);
}
