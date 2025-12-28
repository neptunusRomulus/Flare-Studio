import { useEffect } from 'react';
import type { TileMapEditor } from '@/editor/TileMapEditor';

export default function useActiveGidCallback(editor?: TileMapEditor | null, setActiveGid?: (s: string) => void) {
  useEffect(() => {
    if (!editor || !setActiveGid) return;
    const cb = (gid: number) => {
      setActiveGid(gid > 0 ? gid.toString() : '(none)');
    };
    if (typeof editor.setActiveGidCallback === 'function') editor.setActiveGidCallback(cb);
    return () => {
      if (typeof editor.setActiveGidCallback === 'function') editor.setActiveGidCallback(null);
    };
  }, [editor, setActiveGid]);
}
