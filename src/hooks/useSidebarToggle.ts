import { useCallback } from 'react';
import type { TileMapEditor } from '@/editor/TileMapEditor';

type SetBool = (value: boolean | ((prev: boolean) => boolean)) => void;

type EditorWithSidebar = TileMapEditor & {
  setSidebarTransitioning?: (v: boolean) => void;
};

export default function useSidebarToggle(args: { editor?: TileMapEditor | null; setLeftTransitioning: SetBool; setLeftCollapsed: SetBool; }) {
  const { editor, setLeftTransitioning, setLeftCollapsed } = args;

  const handleSidebarToggle = useCallback(() => {
    setLeftTransitioning(true);
    try {
      const ed = editor as EditorWithSidebar | undefined;
      if (ed && typeof ed.setSidebarTransitioning === 'function') ed.setSidebarTransitioning(true);
    } catch {
      // ignore
    }
    setLeftCollapsed((s) => !s);
    window.setTimeout(() => {
      setLeftTransitioning(false);
      try {
        const ed = editor as EditorWithSidebar | undefined;
        if (ed && typeof ed.setSidebarTransitioning === 'function') ed.setSidebarTransitioning(false);
      } catch {
        // ignore
      }
    }, 380);
  }, [editor, setLeftCollapsed, setLeftTransitioning]);

  return { handleSidebarToggle };
}
