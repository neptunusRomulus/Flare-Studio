import { useCallback, useEffect, useState } from 'react';
import type { Stamp, StampMode } from '@/types';
import type { TileMapEditor } from '@/editor/TileMapEditor';

type UseToolbarStateReturn = {
  stamps: Stamp[];
  selectedStamp: string | null;
  stampMode: StampMode;
  showStampDialog: boolean;
  newStampName: string;
  setNewStampName: (v: string) => void;
  setShowStampDialog: (v: boolean) => void;
  createStamp: (name: string) => boolean;
  selectStamp: (id: string | null) => void;
  deleteStamp: (id: string) => boolean;
  refreshStamps: () => void;
};

export default function useToolbarState(editor: TileMapEditor | null): UseToolbarStateReturn {
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [selectedStamp, setSelectedStamp] = useState<string | null>(null);
  const [stampMode, setStampMode] = useState<StampMode>('select');
  const [showStampDialog, setShowStampDialog] = useState(false);
  const [newStampName, setNewStampName] = useState('');

  const refreshStamps = useCallback(() => {
    if (!editor) {
      setStamps([]);
      return;
    }
    try {
      const list = editor.getStamps();
      setStamps(list);
    } catch {
      // ignore
      setStamps([]);
    }
  }, [editor]);

  useEffect(() => {
    // call refresh asynchronously to avoid sync setState-in-effect
    const t = setTimeout(() => { refreshStamps(); }, 0);
    if (!editor) return () => clearTimeout(t);
    const cb = (list: Stamp[]) => setStamps(list);
    editor.setStampCallback(cb);
    return () => {
      clearTimeout(t);
      try { editor.setStampCallback(null); } catch { /* ignore */ }
    };
  }, [editor, refreshStamps]);

  const createStamp = useCallback((name: string) => {
    if (!editor || !name.trim()) return false;
    const ok = editor.createStampFromSelection(name.trim());
    if (ok) {
      setNewStampName('');
      setShowStampDialog(false);
      setStampMode('select');
      // stamps updated via callback
    }
    return ok;
  }, [editor]);

  const selectStamp = useCallback((id: string | null) => {
    if (!editor) {
      setSelectedStamp(id);
      setStampMode(id ? 'place' : 'select');
      return;
    }
    editor.setActiveStamp(id);
    setSelectedStamp(id);
    setStampMode(id ? 'place' : 'select');
  }, [editor]);

  const deleteStamp = useCallback((id: string) => {
    if (!editor) return false;
    const ok = editor.deleteStamp(id);
    if (ok && selectedStamp === id) {
      setSelectedStamp(null);
      setStampMode('select');
    }
    return ok;
  }, [editor, selectedStamp]);

  return {
    stamps,
    selectedStamp,
    stampMode,
    showStampDialog,
    newStampName,
    setNewStampName,
    setShowStampDialog,
    createStamp,
    selectStamp,
    deleteStamp,
    refreshStamps
  };
}
