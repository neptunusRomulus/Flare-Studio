import { useEffect, useState } from 'react';
import { TileMapEditor } from '@/editor/TileMapEditor';
import useManualSave from './useManualSave';

/**
 * Hook to set up manual save (Ctrl+S) support on the editor.
 * Must be called within SaveQueueProvider context.
 */
export default function useManualSaveSetup(
  editor: TileMapEditor | null | undefined,
  currentProjectPath: string | null | undefined,
  handleManualSaveRef?: React.MutableRefObject<(() => Promise<void>) | undefined>,
  onAfterSave?: () => void | Promise<void>
) {
  const [isManuallySaving, setIsManuallySaving] = useState(false);

  // Create manual save handler - this uses useSaveQueue which requires SaveQueueProvider
  const { handleManualSave } = useManualSave({
    editor: editor ?? null,
    currentProjectPath: currentProjectPath ?? null,
    setIsManuallySaving,
    setLastSaveTime: () => {},
    manualSaveRef: handleManualSaveRef,
    onAfterSave
  });

  // Wire up the manual save callback to the editor for Ctrl+S support
  useEffect(() => {
    if (editor && handleManualSave && typeof editor.setManualSaveCallback === 'function') {
      // Wrap to match expected Promise<void> signature
      editor.setManualSaveCallback(async () => { await handleManualSave(); });
    }
    return () => {
      if (editor && typeof editor.setManualSaveCallback === 'function') {
        editor.setManualSaveCallback(async () => {});
      }
    };
  }, [editor, handleManualSave]);

  return { handleManualSave, isManuallySaving };
}
