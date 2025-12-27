import { useCallback, useEffect, useRef, useState } from 'react';

type SaveStatus = 'saving' | 'saved' | 'error' | 'unsaved';

export default function useAutosave(opts: { manualSaveRef: React.MutableRefObject<(() => Promise<void>) | undefined>; autoSaveInterval?: number; debounceMs?: number }) {
  const { manualSaveRef, autoSaveInterval = 5000, debounceMs = 2000 } = opts;

  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(true);
  const [isManuallySaving, setIsManuallySaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('unsaved');
  const [lastSaveTime, setLastSaveTime] = useState<number>(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const debounceTimer = useRef<number | null>(null);
  const intervalTimer = useRef<number | null>(null);

  const performSave = useCallback(async (manual = false) => {
    const saveFn = manualSaveRef.current;
    if (!saveFn) return false;
    try {
      setIsManuallySaving(manual);
      setSaveStatus('saving');
      await saveFn();
      setLastSaveTime(Date.now());
      setSaveStatus('saved');
      setHasUnsavedChanges(false);
      return true;
    } catch {
      setSaveStatus('error');
      return false;
    } finally {
      setIsManuallySaving(false);
      // clear saved indicator after a short delay
      window.setTimeout(() => { setSaveStatus(prev => prev === 'saved' ? 'unsaved' : prev); }, 2000);
    }
  }, [manualSaveRef]);

  const triggerManualSave = useCallback(async () => performSave(true), [performSave]);

  // Debounced autosave when hasUnsavedChanges flips true
  useEffect(() => {
    if (!autoSaveEnabled) return;
    if (!hasUnsavedChanges) return;
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => {
      void performSave(false);
    }, debounceMs) as unknown as number;
    return () => { if (debounceTimer.current) { window.clearTimeout(debounceTimer.current); debounceTimer.current = null; } };
  }, [hasUnsavedChanges, autoSaveEnabled, debounceMs, performSave]);

  // Periodic autosave heartbeat (saves if there are unsaved changes)
  useEffect(() => {
    if (!autoSaveEnabled) return;
    intervalTimer.current = window.setInterval(() => {
      if (hasUnsavedChanges && !isManuallySaving) {
        void performSave(false);
      }
    }, autoSaveInterval) as unknown as number;
    return () => { if (intervalTimer.current) { window.clearInterval(intervalTimer.current); intervalTimer.current = null; } };
  }, [autoSaveEnabled, autoSaveInterval, hasUnsavedChanges, isManuallySaving, performSave]);

  return {
    autoSaveEnabled,
    setAutoSaveEnabled,
    isManuallySaving,
    setIsManuallySaving,
    saveStatus,
    setSaveStatus,
    lastSaveTime,
    setLastSaveTime,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    triggerManualSave
  } as const;
}
