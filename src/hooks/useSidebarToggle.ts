import { useCallback } from 'react';
import type { TileMapEditor } from '@/editor/TileMapEditor';

type SetBool = (value: boolean | ((prev: boolean) => boolean)) => void;

export default function useSidebarToggle(args: { editor?: TileMapEditor | null; setLeftTransitioning: SetBool; setLeftCollapsed: SetBool; }) {
  const { editor, setLeftTransitioning, setLeftCollapsed } = args;

  const handleSidebarToggle = useCallback(() => {
    setLeftTransitioning(true);
    if (editor && typeof (editor as any).setSidebarTransitioning === 'function') {
      try { (editor as any).setSidebarTransitioning(true); } catch { /* ignore */ }
    }
    setLeftCollapsed((s) => !s);
    window.setTimeout(() => {
      setLeftTransitioning(false);
      if (editor && typeof (editor as any).setSidebarTransitioning === 'function') {
        try { (editor as any).setSidebarTransitioning(false); } catch { /* ignore */ }
      }
    }, 380);
  }, [editor, setLeftCollapsed, setLeftTransitioning]);

  return { handleSidebarToggle };
}
