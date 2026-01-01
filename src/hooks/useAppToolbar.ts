import useEditorRefs from './useEditorRefs';
import useEditorSetup from './useEditorSetup';
import useToolbarSetup from './useToolbarSetup';

export default function useAppToolbar(): { toolbarValue: Record<string, unknown> } {
  const editorRefs = useEditorRefs();
  const editorSetup = useEditorSetup(editorRefs.editorOptsRef);
  const toolbarSetup = useToolbarSetup({ editor: (editorSetup as unknown as Record<string, unknown>)['editor'] });

  const toolbarValue: Record<string, unknown> = {
    ...toolbarSetup.toolbarState,
    stampsState: toolbarSetup.stampsState
  };

  return { toolbarValue };
}
