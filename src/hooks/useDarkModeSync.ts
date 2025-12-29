import { useEffect } from 'react';
import type { TileMapEditor } from '@/editor/TileMapEditor';

export default function useDarkModeSync(isDarkMode: boolean, editor?: TileMapEditor | null) {
  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');

    if (editor && typeof editor.setDarkMode === 'function') {
      try { editor.setDarkMode(isDarkMode); } catch { /* ignore */ }
    }

    try { localStorage.setItem('isDarkMode', JSON.stringify(isDarkMode)); } catch { /* ignore */ }
  }, [isDarkMode, editor]);
}
