import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export type DirtySaveFn = () => Promise<void> | void;

type SaveHealthContextValue = {
  sources: Record<string, boolean>;
  editorDirty: boolean;
  setSource: (id: string, dirty: boolean, save?: DirtySaveFn) => void;
  clearSource: (id: string) => void;
  saveDirtySources: () => Promise<void>;
};

const SaveHealthContext = createContext<SaveHealthContextValue | null>(null);

export function SaveHealthProvider({ children }: { children: React.ReactNode }) {
  const [sources, setSources] = useState<Record<string, boolean>>({});
  const savesRef = useRef<Record<string, DirtySaveFn | undefined>>({});
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;

  const setSource = useCallback((id: string, dirty: boolean, save?: DirtySaveFn) => {
    savesRef.current[id] = save;
    setSources((prev) => (prev[id] === dirty ? prev : { ...prev, [id]: dirty }));
  }, []);

  const clearSource = useCallback((id: string) => {
    delete savesRef.current[id];
    setSources((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const saveDirtySources = useCallback(async () => {
    const dirtyIds = Object.entries(sourcesRef.current).filter(([, dirty]) => dirty).map(([id]) => id);
    for (const id of dirtyIds) {
      const save = savesRef.current[id];
      if (!save) continue;
      await save();
    }
  }, []);

  const editorDirty = useMemo(() => Object.values(sources).some(Boolean), [sources]);

  const value = useMemo<SaveHealthContextValue>(() => ({
    sources,
    editorDirty,
    setSource,
    clearSource,
    saveDirtySources,
  }), [sources, editorDirty, setSource, clearSource, saveDirtySources]);

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

/** Report an editor's dirty flag (and optional save) to the app-level logo / close prompt. */
export function useRegisterDirty(id: string, dirty: boolean, save?: DirtySaveFn): void {
  const ctx = useSaveHealthOptional();
  const setSource = ctx?.setSource;
  const clearSource = ctx?.clearSource;
  const saveRef = useRef(save);
  saveRef.current = save;
  const hasSave = typeof save === 'function';

  useEffect(() => {
    if (!setSource) return;
    const run = hasSave ? () => Promise.resolve(saveRef.current?.()) : undefined;
    setSource(id, dirty, run);
  }, [setSource, id, dirty, hasSave]);

  useEffect(() => {
    if (!clearSource) return;
    return () => clearSource(id);
  }, [clearSource, id]);
}
