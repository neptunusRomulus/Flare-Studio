import useEditorRefs from './useEditorRefs';
import useEditorSetup from './useEditorSetup';
import useToolbarSetup from './useToolbarSetup';
import type { TileMapEditor } from '@/editor/TileMapEditor';

export default function useAppToolbar(): { toolbarValue: Record<string, unknown> } {
  const editorRefs = useEditorRefs();
  const editorSetup = useEditorSetup(editorRefs.editorOptsRef);
  const toolbarSetup = useToolbarSetup({ editor: (editorSetup as any).editor as TileMapEditor | null });

  const toolbarValue: Record<string, unknown> = {
    ...toolbarSetup.toolbarState,
    stampsState: toolbarSetup.stampsState
  };

  return { toolbarValue };
}
